class RetirementCalculator:

    @staticmethod
    def get_return_rate(sector: str, age: int) -> float:
        if sector in ['central_govt', 'state_govt']:
            return 0.085
        elif age < 35:
            return 0.10
        elif age < 50:
            return 0.09
        else:
            return 0.085

    @staticmethod
    def calculate_projected_corpus(
        current_corpus: float,
        monthly_contribution: float,
        years: int,
        annual_return_rate: float,
        step_up_percent: float = 0
    ) -> float:
        r = annual_return_rate

        if step_up_percent == 0:
            # Standard compound formula
            future_corpus = current_corpus * ((1 + r) ** years)
            annual_contribution = monthly_contribution * 12
            future_contributions = annual_contribution * (
                ((1 + r) ** years - 1) / r
            ) if r > 0 else annual_contribution * years
            return future_corpus + future_contributions
        else:
            # Step-up formula
            s = step_up_percent / 100
            future_corpus = current_corpus * ((1 + r) ** years)
            annual_contribution = monthly_contribution * 12
            future_contributions = 0
            for year in range(1, years + 1):
                contribution = annual_contribution * ((1 + s) ** (year - 1))
                future_contributions += contribution * (
                    (1 + r) ** (years - year)
                )
            return future_corpus + future_contributions

    @staticmethod
    def calculate_required_corpus(
        monthly_need_today: float,
        years_to_retirement: int,
        inflation_rate: float = 0.06,
        retirement_duration: int = 25
    ) -> float:
        inflated_monthly = monthly_need_today * (
            (1 + inflation_rate) ** years_to_retirement
        )
        return inflated_monthly * 12 * retirement_duration

    @staticmethod
    def calculate_readiness_score(
        projected: float,
        required: float
    ) -> int:
        if required == 0:
            return 0
        ratio = projected / required
        if ratio >= 1.0:
            return 100
        elif ratio >= 0.8:
            return int(80 + (ratio - 0.8) / 0.2 * 20)
        elif ratio >= 0.6:
            return int(60 + (ratio - 0.6) / 0.2 * 20)
        elif ratio >= 0.4:
            return int(40 + (ratio - 0.4) / 0.2 * 20)
        elif ratio >= 0.2:
            return int(20 + (ratio - 0.2) / 0.2 * 20)
        else:
            return int(ratio / 0.2 * 20)

    @staticmethod
    def get_marginal_tax_rate(
        annual_income: float,
        regime: str
    ) -> float:
        if regime == 'new':
            if annual_income <= 700000:
                return 0.0
            elif annual_income <= 1000000:
                return 0.10
            elif annual_income <= 1200000:
                return 0.15
            elif annual_income <= 1500000:
                return 0.20
            else:
                return 0.30
        else:  # old regime
            if annual_income <= 250000:
                return 0.0
            elif annual_income <= 500000:
                return 0.05
            elif annual_income <= 1000000:
                return 0.20
            else:
                return 0.30

    @staticmethod
    def calculate_personalized_insights(
        user_context: dict
    ) -> dict:
        age = user_context['age']
        sector = user_context['sector']
        monthly_salary = user_context['monthly_salary']
        annual_salary = monthly_salary * 12
        current_corpus = user_context['current_corpus']
        monthly_contribution = user_context['monthly_contribution']
        retirement_age = user_context['target_retirement_age']
        tax_regime = user_context.get('tax_regime', '') or ''
        monthly_need = user_context['retirement_monthly_need']

        years = max(1, retirement_age - age)
        return_rate = RetirementCalculator.get_return_rate(
            sector, age
        )
        marginal_rate = RetirementCalculator.get_marginal_tax_rate(
            annual_salary, tax_regime
        )

        # Basic salary assumption
        basic_percent = 0.6 if sector in [
            'central_govt', 'state_govt'
        ] else 0.4
        annual_basic = annual_salary * basic_percent

        # Current projections
        projected = RetirementCalculator.calculate_projected_corpus(
            current_corpus, monthly_contribution,
            years, return_rate
        )
        required = RetirementCalculator.calculate_required_corpus(
            monthly_need, years
        )
        current_score = RetirementCalculator.calculate_readiness_score(
            projected, required
        )

        # 80CCD(1) analysis
        max_80ccd1 = min(annual_basic * 0.10, 150000)
        annual_employee = monthly_contribution * 12
        utilized_80ccd1 = min(annual_employee, max_80ccd1)
        missed_80ccd1 = max_80ccd1 - utilized_80ccd1

        # 80CCD(1B) analysis
        excess = max(0, annual_employee - utilized_80ccd1)
        utilized_80ccd1b = min(excess, 50000)
        missed_80ccd1b = 50000 - utilized_80ccd1b
        monthly_needed_for_80ccd1b = round(
            missed_80ccd1b / 12
        ) if missed_80ccd1b > 0 else 0

        # 80CCD(2) analysis
        max_percent = 0.14 if sector in [
            'central_govt', 'state_govt'
        ] or tax_regime == 'new' else 0.10
        max_80ccd2 = annual_basic * max_percent

        # Step-up simulation
        score_with_stepup = RetirementCalculator.calculate_readiness_score(
            RetirementCalculator.calculate_projected_corpus(
                current_corpus, monthly_contribution,
                years, return_rate, step_up_percent=10
            ),
            required
        )

        # +2000/month simulation
        score_with_extra = RetirementCalculator.calculate_readiness_score(
            RetirementCalculator.calculate_projected_corpus(
                current_corpus, monthly_contribution + 2000,
                years, return_rate
            ),
            required
        )

        # Retire 2 years later simulation
        score_retire_later = RetirementCalculator.calculate_readiness_score(
            RetirementCalculator.calculate_projected_corpus(
                current_corpus, monthly_contribution,
                years + 2, return_rate
            ),
            RetirementCalculator.calculate_required_corpus(
                monthly_need, years + 2
            )
        )

        # Tax leakage
        total_tax_leakage = (
            missed_80ccd1b * marginal_rate
        ) * (1 + 0.04)  # include cess

        return {
            'years_to_retirement': years,
            'return_rate_percent': return_rate * 100,
            'projected_corpus': round(projected),
            'required_corpus': round(required),
            'current_score': current_score,
            'gap': round(max(0, required - projected)),
            'marginal_tax_rate_percent': marginal_rate * 100,
            'annual_basic': round(annual_basic),

            # 80CCD analysis
            'max_80ccd1': round(max_80ccd1),
            'utilized_80ccd1': round(utilized_80ccd1),
            'missed_80ccd1': round(missed_80ccd1),
            'utilized_80ccd1b': round(utilized_80ccd1b),
            'missed_80ccd1b': round(missed_80ccd1b),
            'monthly_needed_for_80ccd1b':
                monthly_needed_for_80ccd1b,
            'max_80ccd2': round(max_80ccd2),
            'tax_leakage': round(total_tax_leakage),

            # Score simulations
            'score_with_10pct_stepup': score_with_stepup,
            'score_with_extra_2000': score_with_extra,
            'score_retire_2_years_later': score_retire_later,
            'stepup_score_improvement':
                score_with_stepup - current_score,
            'extra_2000_improvement':
                score_with_extra - current_score,
            'retire_later_improvement':
                score_retire_later - current_score,
        }
