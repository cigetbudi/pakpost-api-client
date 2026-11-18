using Mediator;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.Commands;

public sealed record UpdateWorkspaceMemberRolesCommand(Guid ActorId, Guid WorkspaceId, Guid UserId,
    IReadOnlyList<WorkspaceAccessRole> Roles):IRequest<MemberDto>;
