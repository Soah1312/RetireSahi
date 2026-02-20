import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/rupee_display.dart';
import '../providers/dashboard_provider.dart';

// ─────────────────────────────────────────────────────────────
// ReadinessArcHero — animated arc gauge + stat columns
// ─────────────────────────────────────────────────────────────

class ReadinessArcHero extends ConsumerStatefulWidget {
  const ReadinessArcHero({super.key});

  @override
  ConsumerState<ReadinessArcHero> createState() => _ReadinessArcHeroState();
}

class _ReadinessArcHeroState extends ConsumerState<ReadinessArcHero>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    _animation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );
    // Start animation after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(dashboardProvider);
    final score = dashboard.readinessScore;
    final scoreColor = dashboard.scoreLabelColor;
    final scoreLabel = dashboard.scoreLabel;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF131929), Color(0xFF1A2640)],
        ),
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        border: Border.all(color: AppColors.borderSubtle, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Two-column row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // LEFT — 60%
              Expanded(
                flex: 6,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Score label chip
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: scoreColor.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(
                          AppSpacing.chipRadius,
                        ),
                      ),
                      child: Text(
                        scoreLabel,
                        style: AppTypography.labelSmall.copyWith(
                          color: scoreColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Retirement Readiness',
                      style: AppTypography.bodySmall,
                    ),
                    const SizedBox(height: 4),

                    // Animated score number
                    AnimatedBuilder(
                      animation: _animation,
                      builder: (context, _) {
                        final animatedScore = (_animation.value * score)
                            .round();
                        return Text(
                          '$animatedScore%',
                          style: AppTypography.displayLarge.copyWith(
                            color: scoreColor,
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                    Text('of your goal funded', style: AppTypography.bodySmall),
                    const SizedBox(height: 20),

                    // Mini stat rows
                    _MiniStatRow(
                      emoji: '📈',
                      label: 'Projected: ',
                      amount: dashboard.projectedCorpus,
                      subtitle: 'Assumes 10% annual returns',
                    ),
                    const SizedBox(height: 6),
                    _MiniStatRow(
                      emoji: '🎯',
                      label: 'Required: ',
                      amount: dashboard.requiredCorpus,
                    ),
                  ],
                ),
              ),
              // RIGHT — 40%
              Expanded(
                flex: 4,
                child: Center(
                  child: AnimatedBuilder(
                    animation: _animation,
                    builder: (context, _) {
                      return _AnimatedArcGauge(
                        progress: _animation.value * (score / 100.0),
                        scoreColor: scoreColor,
                        size: 120,
                      );
                    },
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),
          const Divider(color: AppColors.borderSubtle, thickness: 1),
          const SizedBox(height: 8),

          // Bottom row
          Center(
            child: Text(
              '${dashboard.yearsToRetirement} years to retirement  ·  Monthly need at retirement: ',
              style: AppTypography.bodySmall,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RupeeDisplay(
                amount: dashboard.inflatedMonthlyNeed,
                size: RupeeDisplaySize.small,
              ),
              Text(
                '*',
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Center(
            child: Text(
              '*Adjusted for 6% annual inflation over ${dashboard.yearsToRetirement} years',
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textDisabled,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStatRow extends StatelessWidget {
  final String emoji;
  final String label;
  final double amount;
  final String? subtitle;

  const _MiniStatRow({
    required this.emoji,
    required this.label,
    required this.amount,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 4),
            Text(label, style: AppTypography.bodySmall),
            RupeeDisplay(amount: amount, size: RupeeDisplaySize.small),
          ],
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.only(left: 22),
            child: Text(
              subtitle!,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textDisabled,
                fontSize: 10,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Arc Gauge
// ─────────────────────────────────────────────────────────────

class _AnimatedArcGauge extends StatelessWidget {
  final double progress; // 0.0 to 1.0
  final Color scoreColor;
  final double size;

  const _AnimatedArcGauge({
    required this.progress,
    required this.scoreColor,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _ArcGaugePainter(
          progress: progress.clamp(0.0, 1.0),
          scoreColor: scoreColor,
        ),
      ),
    );
  }
}

class _ArcGaugePainter extends CustomPainter {
  final double progress;
  final Color scoreColor;

  _ArcGaugePainter({required this.progress, required this.scoreColor});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final strokeWidth = 10.0;
    final radius = (size.width - strokeWidth) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius);

    // Arc spans 240 degrees — starts at 150° (math: pi * 5/6), sweeps 240° (pi * 4/3)
    const startAngle = math.pi * 5 / 6; // 150 degrees
    const sweepAngle = math.pi * 4 / 3; // 240 degrees

    // Background track
    final bgPaint = Paint()
      ..color = AppColors.borderMedium
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, startAngle, sweepAngle, false, bgPaint);

    if (progress > 0.0) {
      // Foreground arc with exact scoreColor
      final scorePaint = Paint()
        ..color = scoreColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      final actualSweep = sweepAngle * progress;
      canvas.drawArc(rect, startAngle, actualSweep, false, scorePaint);

      // Glowing dot at tip
      final tipAngle = startAngle + actualSweep;
      final tipX = center.dx + radius * math.cos(tipAngle);
      final tipY = center.dy + radius * math.sin(tipAngle);
      final tipOffset = Offset(tipX, tipY);

      // Glow
      final glowPaint = Paint()
        ..color = scoreColor
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
      canvas.drawCircle(tipOffset, 5, glowPaint); // 10px circular diameter

      // Solid dot mask
      final dotPaint = Paint()..color = scoreColor;
      canvas.drawCircle(tipOffset, 5, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _ArcGaugePainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.scoreColor != scoreColor;
  }
}
