using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed record UpdateWorkspaceMemberRolesCommand(Guid ActorId, Guid WorkspaceId, Guid UserId,
    IReadOnlyList<WorkspaceAccessRole> Roles):IRequest<MemberDto>;
