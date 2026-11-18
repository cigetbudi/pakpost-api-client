using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed record AddWorkspaceMemberCommand(Guid ActorId, Guid WorkspaceId, string Email,
    WorkspaceRole Role, IReadOnlyList<WorkspaceAccessRole>? Roles = null):IRequest<MemberDto>;
