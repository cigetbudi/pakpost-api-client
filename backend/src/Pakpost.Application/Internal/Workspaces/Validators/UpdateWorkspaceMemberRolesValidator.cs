using FluentValidation;
using Pakpost.Application.Internal.Workspaces.Commands;

namespace Pakpost.Application.Internal.Workspaces.Validators;

public sealed class UpdateWorkspaceMemberRolesValidator : AbstractValidator<UpdateWorkspaceMemberRolesCommand>
{
    public UpdateWorkspaceMemberRolesValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Roles).NotNull().Must(x => x is {Count:>0 and <= 5} &&
            x.All(r => Enum.IsDefined(r))).WithMessage("Select one or more valid roles");
    }
}
