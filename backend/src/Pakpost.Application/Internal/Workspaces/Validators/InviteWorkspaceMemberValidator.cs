using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Mediator;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed class InviteWorkspaceMemberValidator : AbstractValidator<InviteWorkspaceMemberCommand>
{
    public InviteWorkspaceMemberValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x => x.Roles).NotNull().Must(x => x is {Count:>0 and <= 5} && x.All(r => Enum.IsDefined(r)))
        .WithMessage("Choose one or more valid roles");
    }
}
