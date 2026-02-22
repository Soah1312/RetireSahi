import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../features/onboarding/domain/onboarding_state.dart';
import '../../../../features/onboarding/presentation/onboarding_provider.dart';
import '../../../../core/utils/retirement_calculator.dart';
import '../../../ai_assistant/data/ai_assistant_service.dart';

// ─────────────────────────────────────────────────────────────
// Chat Message Model
// ─────────────────────────────────────────────────────────────

class ChatMessage {
  final String text;
  final bool isUser;
  final String? sourceLabel;
  final List<dynamic> sources;
  final bool isFallback;
  final DateTime timestamp;

  const ChatMessage({
    required this.text,
    required this.isUser,
    this.sourceLabel,
    this.sources = const [],
    this.isFallback = false,
    required this.timestamp,
  });
}

// ─────────────────────────────────────────────────────────────
// Dashboard Computed State
// ─────────────────────────────────────────────────────────────

class DashboardState {
  final int readinessScore;
  final String scoreLabel;
  final Color scoreLabelColor;
  final double projectedCorpus;
  final double requiredCorpus;
  final double corpusGap;
  final int yearsToRetirement;
  final double inflatedMonthlyNeed;
  final bool isProfileComplete;

  const DashboardState({
    required this.readinessScore,
    required this.scoreLabel,
    required this.scoreLabelColor,
    required this.projectedCorpus,
    required this.requiredCorpus,
    required this.corpusGap,
    required this.yearsToRetirement,
    required this.inflatedMonthlyNeed,
    required this.isProfileComplete,
  });
}

// ─────────────────────────────────────────────────────────────
// Score Calculation Engine
// ─────────────────────────────────────────────────────────────

DashboardState _computeDashboard(OnboardingState s) {
  final age = s.age ?? 0;
  final targetAge = s.targetRetirementAge;
  final years = math.max(0, targetAge - age);

  final currentCorpus = s.currentCorpus ?? 0.0;
  final employeeContrib = s.monthlyEmployeeContribution ?? 0.0;
  final employerContrib = s.monthlyEmployerContribution ?? 0.0;
  final monthlyContrib = employeeContrib + employerContrib;
  final retirementMonthly = s.retirementMonthlyAmount;

  // Return early if no meaningful data
  final isComplete = age > 0 && currentCorpus > 0 && monthlyContrib > 0;

  // Step 1 — Annual return rate
  double r = RetirementCalculator.getReturnRate(
    sector: s.sector ?? '',
    age: age,
  );

  // If active equity allocation is provided and user is <45 (private sect)
  if (age < 45 && s.sector != 'central_govt' && s.equityAllocation > 0) {
    r = 0.085 + (s.equityAllocation / 0.75) * 0.02;
  }

  // Step 2 — Project future corpus
  final projectedCorpus = RetirementCalculator.calculateProjectedCorpus(
    currentCorpus: currentCorpus,
    monthlyContribution: monthlyContrib,
    yearsToRetirement: years,
    annualReturnRate: r,
    stepUpPercent: s.stepUpEnabled ? s.stepUpPercent : 0.0,
  );

  // Step 3 — Required corpus at retirement
  final requiredCorpus = RetirementCalculator.calculateRequiredCorpus(
    monthlyNeedToday: retirementMonthly,
    yearsToRetirement: years,
  );

  // Step 4 — Calculate score
  final score = RetirementCalculator.calculateReadinessScore(
    projectedCorpus: projectedCorpus,
    requiredCorpus: requiredCorpus,
  );

  // Still need inflated monthly need for state
  final inflatedMonthlyNeed = retirementMonthly * math.pow(1.06, years);

  // Score label
  String label;
  Color color;
  if (score >= 86) {
    label = 'Excellent';
    color = AppColors.success;
  } else if (score >= 71) {
    label = 'Good';
    color = const Color(0xFF66BB6A);
  } else if (score >= 51) {
    label = 'On Track';
    color = AppColors.accentBlue;
  } else if (score >= 31) {
    label = 'At Risk';
    color = const Color(0xFFFF7043);
  } else {
    label = 'Critical';
    color = AppColors.danger;
  }

  return DashboardState(
    readinessScore: score,
    scoreLabel: label,
    scoreLabelColor: color,
    projectedCorpus: projectedCorpus,
    requiredCorpus: requiredCorpus,
    corpusGap: projectedCorpus - requiredCorpus,
    yearsToRetirement: years,
    inflatedMonthlyNeed: inflatedMonthlyNeed,
    isProfileComplete: isComplete,
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard Provider (computed from onboarding state)
// ─────────────────────────────────────────────────────────────

final dashboardProvider = Provider<DashboardState>((ref) {
  final onboarding = ref.watch(onboardingProvider);
  return _computeDashboard(onboarding);
});

// ─────────────────────────────────────────────────────────────
// Chat Provider — Live RAG API
// ─────────────────────────────────────────────────────────────

class ChatNotifier extends StateNotifier<List<ChatMessage>> {
  final Ref _ref;

  ChatNotifier(this._ref) : super([]);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty || _isLoading) return;

    // Add user message immediately
    state = [
      ...state,
      ChatMessage(text: text.trim(), isUser: true, timestamp: DateTime.now()),
    ];

    _isLoading = true;
    state = [...state]; // trigger rebuild for loading indicator

    // Build conversation history (last 8 messages)
    final history = state
        .where((m) => m != state.last) // exclude the just-added user msg
        .take(8)
        .map<Map<String, dynamic>>((m) => {'text': m.text, 'is_user': m.isUser})
        .toList();

    // Build user context from onboarding state
    final onboarding = _ref.read(onboardingProvider);
    final userContext = AIAssistantService.buildUserContext(
      firstName: onboarding.firstName.isNotEmpty
          ? onboarding.firstName
          : 'User',
      age: onboarding.age ?? 30,
      sector: onboarding.sector ?? 'private',
      monthlySalary: onboarding.monthlySalary ?? 0,
      currentCorpus: onboarding.currentCorpus ?? 0,
      monthlyContribution:
          (onboarding.monthlyEmployeeContribution ?? 0) +
          (onboarding.monthlyEmployerContribution ?? 0),
      targetRetirementAge: onboarding.targetRetirementAge,
      taxRegime: '', // Tax regime is in UserProfile, default empty
      lifestyleTier: onboarding.selectedTierName,
      retirementMonthlyNeed: onboarding.retirementMonthlyAmount,
    );

    // Call the live API
    final result = await AIAssistantService.sendMessage(
      message: text.trim(),
      userContext: userContext,
      conversationHistory: history,
    );

    // Build source label from first source
    final sources = result['sources'] as List;
    String? sourceLabel;
    if (sources.isNotEmpty) {
      final first = sources.first;
      if (first is Map) {
        sourceLabel = first['source_name'] as String?;
      }
    }

    state = [
      ...state,
      ChatMessage(
        text: result['response'] as String,
        isUser: false,
        sourceLabel: sourceLabel,
        sources: sources,
        isFallback: result['is_fallback'] as bool,
        timestamp: DateTime.now(),
      ),
    ];

    _isLoading = false;
    state = [...state];
  }
}

final chatProvider = StateNotifierProvider<ChatNotifier, List<ChatMessage>>((
  ref,
) {
  return ChatNotifier(ref);
});

final chatLoadingProvider = Provider<bool>((ref) {
  final notifier = ref.read(chatProvider.notifier);
  // Force rebuild when state changes by watching state
  ref.watch(chatProvider);
  return notifier.isLoading;
});
