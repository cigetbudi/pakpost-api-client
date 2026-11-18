using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Queries;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class ListWorkspaceMembersHandler(
    IWorkspaceRepository workspaces,
    IUserRepository users)
    : IRequestHandler<ListWorkspaceMembersQuery, IReadOnlyList<MemberDto>>
{
    public async ValueTask<IReadOnlyList<MemberDto>> Handle(
        ListWorkspaceMembersQuery query,
        CancellationToken ct)
    {
        await WorkspacePermissions.RequireMemberAsync(
            workspaces,
            query.WorkspaceId,
            query.ActorId,
            ct);

        var memberships = await workspaces.ListMembersAsync(query.WorkspaceId, ct);

        if (memberships.Count == 0)
        {
            return [];
        }

        var userIds = memberships.Select(member => member.UserId).Distinct().ToArray();
        var usersById = (await users.FindByIdsAsync(userIds, ct))
            .ToDictionary(user => user.Id);

        var result = new List<MemberDto>(memberships.Count);

        foreach (var member in memberships)
        {
            if (!usersById.TryGetValue(member.UserId, out var user))
            {
                continue;
            }

            var roles = WorkspacePermissions.RolesOf(member);

            result.Add(new MemberDto(
                member.UserId,
                user.Email,
                user.DisplayName,
                member.Role,
                roles,
                WorkspacePermissions.EffectivePermissions(roles)));
        }

        return result;
    }
}
