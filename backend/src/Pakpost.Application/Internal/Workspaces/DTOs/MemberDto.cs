using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.DTOs;

public sealed record MemberDto(Guid UserId, string Email, string DisplayName, WorkspaceRole Role,
    IReadOnlyList<WorkspaceAccessRole> Roles, IReadOnlyList<string> Permissions);
