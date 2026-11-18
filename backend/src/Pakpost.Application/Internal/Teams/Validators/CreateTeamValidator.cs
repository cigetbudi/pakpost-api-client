using FluentValidation;
using Pakpost.Application.Internal.Teams.Commands;

namespace Pakpost.Application.Internal.Teams.Validators;

public sealed class CreateTeamValidator : AbstractValidator<CreateTeamCommand>
{
    public CreateTeamValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
}
