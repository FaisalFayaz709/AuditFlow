# controls module

Pass 05 implements enrolled control list/detail and company-specific control state.

Locked rules:

- Template control definitions stay in `Control`.
- Company-specific applicability and ownership stay in `CompanyControl`.
- `NOT_APPLICABLE` requires reason and authorized actor attribution.
- Readiness is not calculated in this pass.
