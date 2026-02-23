import 'dart:convert';
import 'package:http/http.dart' as http;

void main() async {
  final url = 'https://soah-13-nps-pulse-backend.hf.space/chat';
  final payload = {
    'message': 'How do I improve my retirement score?',
    'user_context': {
      'first_name': 'Rahul',
      'age': 28,
      'sector': 'private',
      'monthly_salary': 85000.0,
      'current_corpus': 45000.0,
      'monthly_contribution': 9000.0,
      'target_retirement_age': 58,
      'tax_regime': '',
      'lifestyle_tier': 'comfortable',
      'retirement_monthly_need': 120000.0,
    },
    'conversation_history': [],
  };

  try {
    print('Sending request to $url...');
    final res = await http.post(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: jsonEncode(payload),
    );
    print('Status: ${res.statusCode}');
    print('Body: ${res.body}');
  } catch (e) {
    print('Error: $e');
  }
}
