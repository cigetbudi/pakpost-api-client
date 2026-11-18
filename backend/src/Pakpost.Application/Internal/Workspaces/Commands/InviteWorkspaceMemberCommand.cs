using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Mediator;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.Commands;

public sealed record InviteWorkspaceMemberCommand(Guid ActorId, Guid WorkspaceId, string Email,
    IReadOnlyList<WorkspaceAccessRole> Roles):IRequest<InvitationDto>;
