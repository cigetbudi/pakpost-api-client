using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using FluentValidation;
using Pakpost.Application.Internal.Workspaces.Commands;

namespace Pakpost.Application.Internal.Workspaces.Validators;

public sealed class AcceptWorkspaceInvitationValidator : AbstractValidator<AcceptWorkspaceInvitationCommand>
{
    public AcceptWorkspaceInvitationValidator() => RuleFor(x => x.Token).NotEmpty().MaximumLength(256);
}
