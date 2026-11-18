using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Mediator;
using Pakpost.Application.Internal.Workspaces.DTOs;

namespace Pakpost.Application.Internal.Workspaces.Commands;

public sealed record AcceptWorkspaceInvitationCommand(Guid ActorId, string Token) : IRequest<WorkspaceDto>;
