import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';

class InflationBadge extends StatelessWidget {
  final bool isInflated;

  const InflationBadge({super.key, this.isInflated = true});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.backgroundTertiary,
        borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
      ),
      child: Text(
        isInflated ? 'inflation-adjusted' : 'today\'s value',
        style: AppTypography.labelSmall.copyWith(color: AppColors.textDisabled),
      ),
    );
  }
}
