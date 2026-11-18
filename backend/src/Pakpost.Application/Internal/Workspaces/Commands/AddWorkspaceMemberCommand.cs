using Mediator;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.Commands;

public sealed record AddWorkspaceMemberCommand(Guid ActorId, Guid WorkspaceId, string Email,
    WorkspaceRole Role, IReadOnlyList<WorkspaceAccessRole>? Roles = null):IRequest<MemberDto>;
