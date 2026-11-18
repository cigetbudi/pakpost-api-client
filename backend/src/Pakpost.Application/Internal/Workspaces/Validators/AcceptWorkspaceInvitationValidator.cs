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

public sealed class AcceptWorkspaceInvitationValidator : AbstractValidator<AcceptWorkspaceInvitationCommand>
{
    public AcceptWorkspaceInvitationValidator() => RuleFor(x => x.Token).NotEmpty().MaximumLength(256);
}
