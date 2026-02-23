import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class AIAssistantService {
  static const String baseUrl = 'https://soah-13-nps-pulse-backend.hf.space';

  static const Duration chatTimeout = Duration(seconds: 90);
  static const Duration pingTimeout = Duration(seconds: 15);

  /// Wake up the Hugging Face server (free tier sleeps after inactivity).
  /// Call this after user logs in so it's ready by the time they open chat.
  static Future<bool> wakeUpServer() async {
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/health'))
          .timeout(pingTimeout);
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  /// Send a chat message to the RAG backend.
  static Future<Map<String, dynamic>> sendMessage({
    required String message,
    required Map<String, dynamic> userContext,
    required List<Map<String, dynamic>> conversationHistory,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/chat'),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: jsonEncode({
              'message': message,
              'user_context': userContext,
              'conversation_history': conversationHistory,
            }),
          )
          .timeout(chatTimeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          'success': true,
          'response': data['response'] as String,
          'sources': (data['sources'] as List?) ?? [],
          'is_fallback': (data['is_fallback'] as bool?) ?? false,
        };
      } else {
        return _errorResponse(
          'Server error (${response.statusCode}). Please try again.',
        );
      }
    } on TimeoutException {
      return _errorResponse(
        'The advisor is taking longer than usual. '
        'Please try again in a moment.',
      );
    } catch (e) {
      return _errorResponse(
        'Unable to reach the advisor. '
        'Please check your connection.',
      );
    }
  }

  static Map<String, dynamic> _errorResponse(String message) {
    return {
      'success': false,
      'response': message,
      'sources': <dynamic>[],
      'is_fallback': true,
    };
  }

  /// Build user context dict from OnboardingState fields.
  static Map<String, dynamic> buildUserContext({
    required String firstName,
    required int age,
    required String sector,
    required double monthlySalary,
    required double currentCorpus,
    required double monthlyContribution,
    required int targetRetirementAge,
    required String taxRegime,
    required String lifestyleTier,
    required double retirementMonthlyNeed,
  }) {
    return {
      'first_name': firstName,
      'age': age,
      'sector': sector,
      'monthly_salary': monthlySalary,
      'current_corpus': currentCorpus,
      'monthly_contribution': monthlyContribution,
      'target_retirement_age': targetRetirementAge,
      'tax_regime': taxRegime,
      'lifestyle_tier': lifestyleTier,
      'retirement_monthly_need': retirementMonthlyNeed,
    };
  }
}
