using FluentValidation;
using Pakpost.Application.Internal.Teams.Commands;

namespace Pakpost.Application.Internal.Teams.Validators;

public sealed class AddTeamMemberValidator : AbstractValidator<AddTeamMemberCommand>
{
    public AddTeamMemberValidator() => RuleFor(x => x.Email).NotEmpty().EmailAddress();
}
