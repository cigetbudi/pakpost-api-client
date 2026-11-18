using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Common.Security;

public static class WorkspacePermissions
{
    public const string WorkspaceCreate = "workspace.create";
    public const string WorkspaceManage = "workspace.manage";
    public const string MemberManage = "member.manage";
    public const string RoleAssign = "role.assign";
    public const string TeamManage = "team.manage";
    public const string CollectionRead = "collection.read";
    public const string CollectionWrite = "collection.write";
    public const string EnvironmentRead = "environment.read";
    public const string EnvironmentWrite = "environment.write";
    public const string EnvironmentSecretRead = "environment.secret.read";
    public const string RequestExecute = "request.execute";

    private static readonly string[] All =
    [
        WorkspaceCreate,
        WorkspaceManage,
        MemberManage,
        RoleAssign,
        TeamManage,
        CollectionRead,
        CollectionWrite,
        EnvironmentRead,
        EnvironmentWrite,
        EnvironmentSecretRead,
        RequestExecute
    ];

    public static IReadOnlyList<WorkspaceAccessRole> RolesOf(WorkspaceMember member)
    {
        return member.Roles
            .Select(role => role.Role)
            .Distinct()
            .ToArray();
    }

    public static IReadOnlyList<string> EffectivePermissions(IEnumerable<WorkspaceAccessRole> roles)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);

        foreach (var role in roles)
        {
            string[] permissions = role switch
            {
                WorkspaceAccessRole.TeamLead => All,
                WorkspaceAccessRole.WorkspaceAdmin =>
                [
                    WorkspaceManage,
                    MemberManage,
                    RoleAssign,
                    TeamManage,
                    CollectionRead,
                    EnvironmentRead,
                    EnvironmentWrite,
                    EnvironmentSecretRead,
                    RequestExecute
                ],
                WorkspaceAccessRole.Developer =>
                [
                    CollectionRead,
                    CollectionWrite,
                    EnvironmentRead,
                    RequestExecute
                ],
                WorkspaceAccessRole.QA =>
                [
                    CollectionRead,
                    EnvironmentRead,
                    RequestExecute
                ],
                WorkspaceAccessRole.TechnicalWriter =>
                [
                    CollectionRead,
                    EnvironmentRead,
                    RequestExecute
                ],
                _ => []
            };

            result.UnionWith(permissions);
        }

        return result.OrderBy(permission => permission, StringComparer.Ordinal).ToArray();
    }

    public static bool Can(WorkspaceMember member, string permission)
    {
        return EffectivePermissions(RolesOf(member))
            .Contains(permission, StringComparer.Ordinal);
    }

    public static async Task<bool> CanCreateWorkspaceAsync(
        IWorkspaceRepository workspaces,
        Guid actorId,
        CancellationToken ct)
    {
        foreach (var workspace in await workspaces.ListForUserAsync(actorId, ct))
        {
            var membership = await workspaces.FindMemberAsync(workspace.Id, actorId, ct);

            if (membership is not null && Can(membership, WorkspaceCreate))
            {
                return true;
            }
        }

        return !await workspaces.AnyWorkspaceAsync(ct);
    }

    public static async Task<WorkspaceMember> RequireMemberAsync(
        IWorkspaceRepository workspaces,
        Guid workspaceId,
        Guid actorId,
        CancellationToken ct)
    {
        return await workspaces.FindMemberAsync(workspaceId, actorId, ct)
            ?? throw AppException.Forbidden();
    }

    public static async Task<WorkspaceMember> RequireAsync(
        IWorkspaceRepository workspaces,
        Guid workspaceId,
        Guid actorId,
        string permission,
        CancellationToken ct)
    {
        var actor = await RequireMemberAsync(workspaces, workspaceId, actorId, ct);

        if (!Can(actor, permission))
        {
            throw AppException.Forbidden($"Missing permission: {permission}");
        }

        return actor;
    }

    public static async Task RequireManagerAsync(
        IWorkspaceRepository workspaces,
        Guid workspaceId,
        Guid actorId,
        CancellationToken ct)
    {
        await RequireAsync(workspaces, workspaceId, actorId, WorkspaceManage, ct);
    }
}
