using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed class UpdateWorkspaceMemberRolesValidator : AbstractValidator<UpdateWorkspaceMemberRolesCommand>
{
    public UpdateWorkspaceMemberRolesValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Roles).NotNull().Must(x => x is {Count:>0 and <= 5} &&
            x.All(r => Enum.IsDefined(r))).WithMessage("Select one or more valid roles");
    }
}
