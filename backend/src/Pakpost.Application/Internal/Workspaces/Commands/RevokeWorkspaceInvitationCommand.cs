using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Mediator;

namespace Pakpost.Application.Internal.Workspaces.Commands;

public sealed record RevokeWorkspaceInvitationCommand(Guid ActorId, Guid WorkspaceId, Guid InvitationId) : IRequest<bool>;
