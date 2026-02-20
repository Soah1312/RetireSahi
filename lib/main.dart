import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/services/supabase_service.dart';
import 'shared/models/user_profile.dart';
import 'features/auth/presentation/auth_provider.dart';
import 'features/onboarding/presentation/onboarding_provider.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables
  await dotenv.load(fileName: '.env');

  // Initialize Supabase
  await SupabaseService.initialize();

  // Pre-load session data before runApp to prevent Router flashing
  final session = Supabase.instance.client.auth.currentSession;
  UserProfile? initialProfile;
  Map<String, dynamic>? initialNpsData;
  List<Map<String, dynamic>> initialGoals = [];

  if (session != null) {
    try {
      final userId = session.user.id;
      final profileRes = await Supabase.instance.client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
      initialProfile = UserProfile.fromJson(profileRes);

      initialNpsData = await Supabase.instance.client
          .from('nps_data')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

      final goalsRes = await Supabase.instance.client
          .from('lifestyle_goals')
          .select('*')
          .eq('user_id', userId);
      initialGoals = List<Map<String, dynamic>>.from(goalsRes);
    } catch (e) {
      debugPrint('Failed to preload user data: $e');
    }
  }

  final container = ProviderContainer(
    overrides: [
      if (initialProfile != null)
        authProvider.overrideWith((ref) => AuthNotifier(ref, initialProfile)),
    ],
  );

  if (initialProfile != null) {
    container
        .read(onboardingProvider.notifier)
        .populateFromProfile(
          profile: initialProfile,
          npsData: initialNpsData,
          goals: initialGoals,
        );
  }

  runApp(UncontrolledProviderScope(container: container, child: const App()));
}
