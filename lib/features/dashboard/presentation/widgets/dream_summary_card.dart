import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/nps_card.dart';
import '../../../../shared/widgets/rupee_display.dart';
import '../../../../features/onboarding/presentation/onboarding_provider.dart';
import '../providers/dashboard_provider.dart';

/// Displays the user's selected lifestyle tier and line items.
class DreamSummaryCard extends ConsumerWidget {
  const DreamSummaryCard({super.key});

  String _tierDisplayName(String tier) {
    switch (tier) {
      case 'essential':
        return 'Essential Retirement';
      case 'comfortable':
        return 'Comfortable Retirement';
      case 'lavish':
        return 'Lavish Retirement';
      default:
        return 'Retirement Dream';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final onboarding = ref.watch(onboardingProvider);
    final dashboard = ref.watch(dashboardProvider);

    final tierName = onboarding.selectedTierName;
    final lineItems = onboarding.lifestyleLineItems;
    final retirementMonthly = onboarding.retirementMonthlyAmount;
    final inflatedMonthly = dashboard.inflatedMonthlyNeed;

    return NPSCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Your Retirement Dream', style: AppTypography.headingSmall),
              TextButton(
                onPressed: () => context.go('/dashboard/dream'),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 0),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'Edit →',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.accentAmber,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Tier chip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.accentAmber.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
            ),
            child: Text(
              _tierDisplayName(tierName),
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.accentAmber,
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Line items grid (max 4)
          if (lineItems.isNotEmpty) ...[
            _LineItemGrid(lineItems: lineItems),
            const SizedBox(height: 12),
          ],

          // Bottom totals row
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('Total today: ', style: AppTypography.bodySmall),
              Text(
                '₹${_formatAmount(retirementMonthly)}/mo',
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.accentAmber,
                ),
              ),
              Text(' → ', style: AppTypography.bodySmall),
              RupeeDisplay(
                amount: inflatedMonthly,
                size: RupeeDisplaySize.small,
              ),
              Text('/mo at retirement ', style: AppTypography.bodySmall),
              Text(
                '(inflation-adjusted)',
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textDisabled,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatAmount(double amount) {
    if (amount >= 100000) return '${(amount / 100000).toStringAsFixed(1)}L';
    if (amount >= 1000) return '${(amount / 1000).toStringAsFixed(1)}K';
    return amount.toStringAsFixed(0);
  }
}

class _LineItemGrid extends StatelessWidget {
  final List lineItems;

  const _LineItemGrid({required this.lineItems});

  @override
  Widget build(BuildContext context) {
    final display = lineItems.take(4).toList();
    final extra = lineItems.length - display.length;

    return Column(
      children: [
        Row(
          children: [
            for (int i = 0; i < display.length && i < 2; i++) ...[
              Expanded(child: _LineItemTile(item: display[i])),
              if (i == 0) const SizedBox(width: 8),
            ],
          ],
        ),
        if (display.length > 2) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              for (int i = 2; i < display.length && i < 4; i++) ...[
                Expanded(child: _LineItemTile(item: display[i])),
                if (i == 2 && display.length > 3) const SizedBox(width: 8),
              ],
            ],
          ),
        ],
        if (extra > 0) ...[
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              '+$extra more',
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textDisabled,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _LineItemTile extends StatelessWidget {
  final dynamic item;

  const _LineItemTile({required this.item});

  String _toTitleCase(String text) {
    if (text.isEmpty) return text;
    return text
        .split(' ')
        .map((word) {
          if (word.isEmpty) return word;
          return word[0].toUpperCase() + word.substring(1).toLowerCase();
        })
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.backgroundPrimary,
        borderRadius: BorderRadius.circular(AppSpacing.sm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${item.emoji} ${_toTitleCase(item.label)}',
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.textPrimary,
            ),
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          RupeeDisplay(
            amount: item.monthlyAmount,
            size: RupeeDisplaySize.small,
          ),
        ],
      ),
    );
  }
}
