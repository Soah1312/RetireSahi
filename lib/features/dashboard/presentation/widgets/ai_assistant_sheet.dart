import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../features/onboarding/presentation/onboarding_provider.dart';
import '../providers/dashboard_provider.dart';

// ─────────────────────────────────────────────────────────────
// AI Assistant Bottom Sheet
// ─────────────────────────────────────────────────────────────

class AIAssistantSheet extends ConsumerStatefulWidget {
  final String? initialContext;
  const AIAssistantSheet({super.key, this.initialContext});

  @override
  ConsumerState<AIAssistantSheet> createState() => _AIAssistantSheetState();
}

class _AIAssistantSheetState extends ConsumerState<AIAssistantSheet> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _canSend = false;

  @override
  void initState() {
    super.initState();
    _inputController.addListener(() {
      final canSend = _inputController.text.trim().isNotEmpty;
      if (canSend != _canSend) {
        setState(() => _canSend = canSend);
      }
    });
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;
    _inputController.clear();
    setState(() => _canSend = false);

    await ref.read(chatProvider.notifier).sendMessage(text);
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(chatProvider);
    final isLoading = ref.watch(chatLoadingProvider);

    final onboarding = ref.watch(onboardingProvider);
    final firstName = onboarding.firstName.isNotEmpty
        ? onboarding.firstName
        : 'there';

    // Auto-scroll when new messages arrive
    if (messages.isNotEmpty) {
      _scrollToBottom();
    }

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.backgroundSecondary,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // ── Top Bar
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 8, 0),
                child: Column(
                  children: [
                    // Handle bar
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: AppColors.borderMedium,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'NPS Co-Pilot',
                                style: AppTypography.headingSmall,
                              ),
                              Text(
                                'Powered by Cohere Command R+',
                                style: AppTypography.bodySmall.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(
                            Icons.close,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // ── Quick prompts (only when no messages)
              if (messages.isEmpty)
                _QuickPromptChips(
                  onChipTapped: (prompt) {
                    _inputController.text = prompt;
                    setState(() => _canSend = true);
                  },
                ),

              if (messages.isEmpty) const SizedBox(height: 12),
              const Divider(height: 1, color: AppColors.borderSubtle),

              // ── Chat messages
              Expanded(
                child: messages.isEmpty && !isLoading
                    ? _WelcomeMessage(firstName: firstName)
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                        itemCount: messages.length + (isLoading ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index == messages.length && isLoading) {
                            return const _TypingIndicator();
                          }
                          final msg = messages[index];
                          return _ChatBubble(
                            key: ValueKey(msg.timestamp.millisecondsSinceEpoch),
                            message: msg,
                          );
                        },
                      ),
              ),

              // ── Input bar
              _InputBar(
                controller: _inputController,
                canSend: _canSend && !isLoading,
                isLoading: isLoading,
                onSend: () => _sendMessage(_inputController.text),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Welcome Message
// ─────────────────────────────────────────────────────────────

class _WelcomeMessage extends StatelessWidget {
  final String firstName;
  const _WelcomeMessage({required this.firstName});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.backgroundTertiary,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          '👋 Hi $firstName! I\'m your NPS Co-Pilot.\n\n'
          'I can answer questions about your NPS, '
          'tax savings, withdrawal rules, and help '
          'you understand your retirement score.\n\n'
          'What would you like to know?',
          style: AppTypography.bodyMedium.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Quick Prompt Chips (inline)
// ─────────────────────────────────────────────────────────────

class _QuickPromptChips extends StatelessWidget {
  final void Function(String prompt) onChipTapped;

  const _QuickPromptChips({required this.onChipTapped});

  static const List<String> _prompts = [
    'Can I withdraw early?',
    "What's my tax saving?",
    'Explain Tier II NPS',
    'Best fund allocation?',
    'NPS vs PPF?',
    'Partial withdrawal rules?',
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
      child: Row(
        children: _prompts.map((prompt) {
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onChipTapped(prompt),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.backgroundTertiary,
                  borderRadius: BorderRadius.circular(AppSpacing.chipRadius),
                  border: Border.all(color: AppColors.borderMedium, width: 1),
                ),
                child: Text(
                  prompt,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Chat Bubble
// ─────────────────────────────────────────────────────────────

class _ChatBubble extends StatefulWidget {
  final ChatMessage message;

  const _ChatBubble({super.key, required this.message});

  @override
  State<_ChatBubble> createState() => _ChatBubbleState();
}

class _ChatBubbleState extends State<_ChatBubble>
    with SingleTickerProviderStateMixin {
  late AnimationController _anim;
  late Animation<double> _opacity;
  late Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _opacity = Tween<double>(begin: 0, end: 1).animate(_anim);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _anim, curve: Curves.easeOut));
    _anim.forward();
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final msg = widget.message;

    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(
        position: _slide,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            crossAxisAlignment: msg.isUser
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              Align(
                alignment: msg.isUser
                    ? Alignment.centerRight
                    : Alignment.centerLeft,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth:
                        MediaQuery.of(context).size.width *
                        (msg.isUser ? 0.75 : 0.85),
                  ),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: msg.isUser
                          ? AppColors.accentAmber
                          : AppColors.backgroundTertiary,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(16),
                        topRight: const Radius.circular(16),
                        bottomLeft: msg.isUser
                            ? const Radius.circular(16)
                            : const Radius.circular(4),
                        bottomRight: msg.isUser
                            ? const Radius.circular(4)
                            : const Radius.circular(16),
                      ),
                    ),
                    child: Text(
                      msg.text,
                      style: AppTypography.bodyMedium.copyWith(
                        color: msg.isUser
                            ? AppColors.backgroundPrimary
                            : AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ),

              // Source chips
              if (!msg.isUser && msg.sources.isNotEmpty) ...[
                const SizedBox(height: 4),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: msg.sources.map<Widget>((source) {
                      final name = source is Map
                          ? (source['source_name'] ?? 'Source')
                          : 'Source';
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.backgroundSecondary,
                            borderRadius: BorderRadius.circular(
                              AppSpacing.chipRadius,
                            ),
                            border: Border.all(
                              color: AppColors.borderSubtle,
                              width: 1,
                            ),
                          ),
                          child: Text(
                            '📄 $name',
                            style: AppTypography.bodySmall.copyWith(
                              color: AppColors.textDisabled,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],

              // Fallback warning
              if (!msg.isUser && msg.isFallback) ...[
                const SizedBox(height: 4),
                Text(
                  '⚠️ Response from general knowledge',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.warning,
                    fontSize: 11,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Typing Indicator
// ─────────────────────────────────────────────────────────────

class _TypingIndicator extends StatefulWidget {
  const _TypingIndicator();

  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            color: AppColors.backgroundTertiary,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(16),
              topRight: Radius.circular(16),
              bottomRight: Radius.circular(16),
              bottomLeft: Radius.circular(4),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(3, (i) {
              return AnimatedBuilder(
                animation: _controller,
                builder: (context, child) {
                  final phase = (_controller.value - i * 0.2).clamp(0.0, 1.0);
                  final opacity = 0.3 + 0.7 * (0.5 - (phase - 0.5).abs()) * 2;
                  return Padding(
                    padding: EdgeInsets.only(right: i < 2 ? 4 : 0),
                    child: Opacity(
                      opacity: opacity.clamp(0.3, 1.0),
                      child: Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: AppColors.textSecondary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  );
                },
              );
            }),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Input Bar
// ─────────────────────────────────────────────────────────────

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool canSend;
  final bool isLoading;
  final VoidCallback onSend;

  const _InputBar({
    required this.controller,
    required this.canSend,
    required this.isLoading,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      decoration: const BoxDecoration(
        color: AppColors.backgroundSecondary,
        border: Border(top: BorderSide(color: AppColors.borderSubtle)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              maxLines: 3,
              minLines: 1,
              style: AppTypography.bodyMedium.copyWith(
                color: AppColors.textPrimary,
              ),
              decoration: InputDecoration(
                hintText: 'Ask anything about your NPS...',
                hintStyle: AppTypography.bodySmall,
                filled: true,
                fillColor: AppColors.backgroundTertiary,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: const BorderSide(
                    color: AppColors.accentAmber,
                    width: 1.5,
                  ),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
              ),
              onSubmitted: (v) {
                if (canSend) onSend();
              },
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: canSend ? onSend : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: canSend ? AppColors.accentAmber : AppColors.borderMedium,
                shape: BoxShape.circle,
              ),
              child: isLoading
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.backgroundPrimary,
                      ),
                    )
                  : Icon(
                      Icons.send_rounded,
                      color: canSend
                          ? AppColors.backgroundPrimary
                          : AppColors.textDisabled,
                      size: 20,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
