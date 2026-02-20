import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/auth_provider.dart';

import 'go_router_refresh_stream.dart';

// ──────────────────────────────────────────────────────────
// Placeholder screens — will be replaced by feature screens
// ──────────────────────────────────────────────────────────

class _PlaceholderScreen extends StatelessWidget {
  final String title;
  const _PlaceholderScreen({required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text(title, style: AppTypography.headingMedium)),
    );
  }
}

// ──────────────────────────────────────────────────────────
// Shell with bottom navigation
// ──────────────────────────────────────────────────────────

class DashboardShell extends StatelessWidget {
  final Widget child;
  const DashboardShell({super.key, required this.child});

  static int _indexFromLocation(String location) {
    if (location.startsWith('/dashboard/dream')) return 1;
    if (location.startsWith('/dashboard/tax-shield')) return 2;
    if (location.startsWith('/dashboard/insights')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final currentIndex = _indexFromLocation(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: AppColors.borderSubtle, width: 1),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          onTap: (index) {
            switch (index) {
              case 0:
                context.go('/dashboard/home');
                break;
              case 1:
                context.go('/dashboard/dream');
                break;
              case 2:
                context.go('/dashboard/tax-shield');
                break;
              case 3:
                context.go('/dashboard/insights');
                break;
            }
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_rounded),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.auto_awesome_rounded),
              label: 'Dream',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.shield_rounded),
              label: 'Tax Shield',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.insights_rounded),
              label: 'Insights',
            ),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────
// GoRouter configuration
// ──────────────────────────────────────────────────────────

final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(authProvider.notifier);
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: GoRouterRefreshStream(authNotifier.stream),
    redirect: (context, state) {
      final isAuthenticated = authState.value != null;
      final isLoggingIn = state.uri.toString() == '/login';
      final isOnboarding = state.uri.toString() == '/onboarding';

      // If not authenticated and not on login or onboarding, go to login
      if (!isAuthenticated && !isLoggingIn && !isOnboarding) {
        return '/login';
      }

      // If authenticated and on login or onboarding, go to home
      if (isAuthenticated && (isLoggingIn || isOnboarding)) {
        return '/dashboard/home';
      }

      return null;
    },
    routes: [
      // Login
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),

      // Onboarding
      GoRoute(
        path: '/onboarding',
        name: 'onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),

      // Dashboard — shell route with bottom nav
      ShellRoute(
        builder: (context, state, child) => DashboardShell(child: child),
        routes: [
          GoRoute(
            path: '/dashboard/home',
            name: 'dashboard-home',
            pageBuilder: (context, state) => CustomTransitionPage(
              child: const DashboardScreen(),
              transitionsBuilder:
                  (context, animation, secondaryAnimation, child) {
                    return FadeTransition(opacity: animation, child: child);
                  },
              transitionDuration: const Duration(milliseconds: 600),
            ),
          ),
          GoRoute(
            path: '/dashboard/dream',
            name: 'dashboard-dream',
            builder: (context, state) =>
                const _PlaceholderScreen(title: 'Dream Planner'),
          ),
          GoRoute(
            path: '/dashboard/tax-shield',
            name: 'dashboard-tax-shield',
            builder: (context, state) =>
                const _PlaceholderScreen(title: 'Tax Shield'),
          ),
          GoRoute(
            path: '/dashboard/insights',
            name: 'dashboard-insights',
            builder: (context, state) =>
                const _PlaceholderScreen(title: 'Insights'),
          ),
        ],
      ),

      // Standalone routes
      GoRoute(
        path: '/readiness-detail',
        name: 'readiness-detail',
        builder: (context, state) =>
            const _PlaceholderScreen(title: 'Readiness Detail'),
      ),
      GoRoute(
        path: '/monte-carlo',
        name: 'monte-carlo',
        builder: (context, state) =>
            const _PlaceholderScreen(title: 'Monte Carlo'),
      ),
      GoRoute(
        path: '/profile',
        name: 'profile',
        builder: (context, state) => const _PlaceholderScreen(title: 'Profile'),
      ),
    ],
  );
});
