using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using FluentValidation;
using Pakpost.Application.Internal.Workspaces.Commands;

namespace Pakpost.Application.Internal.Workspaces.Validators;

public sealed class InviteWorkspaceMemberValidator : AbstractValidator<InviteWorkspaceMemberCommand>
{
    public InviteWorkspaceMemberValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x => x.Roles).NotNull().Must(x => x is {Count:>0 and <= 5} && x.All(r => Enum.IsDefined(r)))
        .WithMessage("Choose one or more valid roles");
    }
}
