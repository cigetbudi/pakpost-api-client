using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed class AddWorkspaceMemberValidator : AbstractValidator<AddWorkspaceMemberCommand>
{
    public AddWorkspaceMemberValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x => x.Role).Must(x => x is WorkspaceRole.Admin or WorkspaceRole.Member)
        .WithMessage("Legacy role must be Admin or Member");
        RuleFor(x => x.Roles).Must(x => x is null || (x.Count>0 && x.Count <= 5 &&
            x.All(r => Enum.IsDefined(r)))).WithMessage("Select valid roles");
    }
}
