using FluentValidation;
using Pakpost.Application.Internal.Environments.Commands;

namespace Pakpost.Application.Internal.Environments.Validators;

public sealed class UpdateEnvironmentValidator : AbstractValidator<UpdateEnvironmentCommand>
{
    public UpdateEnvironmentValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Variables).NotNull().Must(x => x is not null && x.Count <= 100);
        RuleForEach(x => x.Variables).ChildRules(v =>
            {
                v.RuleFor(x => x.Key).NotEmpty().MaximumLength(120).Matches("^[A-Za-z_][A-Za-z0-9_]*$");
                v.RuleFor(x => x.Value).MaximumLength(8192);
            });
        RuleFor(x => x.Variables).Must(x => x.Select(y => y.Key).Distinct(StringComparer.OrdinalIgnoreCase).Count() == x.Count)
        .When(x => x.Variables is not null).WithMessage("Duplicate variable keys");
    }
}
