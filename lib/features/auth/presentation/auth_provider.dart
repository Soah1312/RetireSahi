import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/user_profile.dart';
import '../../onboarding/presentation/onboarding_provider.dart';

final authProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<UserProfile?>>((ref) {
      return AuthNotifier(ref);
    });

class AuthNotifier extends StateNotifier<AsyncValue<UserProfile?>> {
  final Ref _ref;
  AuthNotifier(this._ref, [UserProfile? initialProfile])
    : super(AsyncValue.data(initialProfile));

  final _client = Supabase.instance.client;

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final authRes = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );

      final user = authRes.user;
      if (user == null) {
        throw Exception('Login failed');
      }

      final response = await _client
          .from('profiles')
          .select()
          .eq('id', user.id)
          .maybeSingle();

      if (response != null) {
        final profile = UserProfile.fromJson(response);
        final userId = profile.id;

        // Fetch related data
        final npsData = await _client
            .from('nps_data')
            .select()
            .eq('user_id', userId)
            .maybeSingle();

        final goals = await _client
            .from('lifestyle_goals')
            .select()
            .eq('user_id', userId);

        // Populate onboarding state so dashboard works
        _ref
            .read(onboardingProvider.notifier)
            .populateFromProfile(
              profile: profile,
              npsData: npsData,
              goals: List<Map<String, dynamic>>.from(goals),
            );

        state = AsyncValue.data(profile);
      } else {
        state = AsyncValue.error(
          'User not found. Please sign up.',
          StackTrace.current,
        );
      }
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> logout() async {
    await _client.auth.signOut();
    state = const AsyncValue.data(null);
  }
}
