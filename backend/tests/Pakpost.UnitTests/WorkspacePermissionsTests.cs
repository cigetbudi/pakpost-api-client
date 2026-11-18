using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Services;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class WorkspacePermissionsTests
{
    [Theory]
    [InlineData(WorkspaceAccessRole.TeamLead, true, true, true)]
    [InlineData(WorkspaceAccessRole.WorkspaceAdmin, true, false, true)]
    [InlineData(WorkspaceAccessRole.Developer, false, true, false)]
    [InlineData(WorkspaceAccessRole.QA, false, false, false)]
    [InlineData(WorkspaceAccessRole.TechnicalWriter, false, false, false)]
    public void PermissionsPreserveRoleBoundaries(
        WorkspaceAccessRole role,
        bool canManageTeam,
        bool canWriteCollections,
        bool canReadSecrets)
    {
        var member = Member(role);

        Assert.Equal(canManageTeam, WorkspacePermissions.Can(member, WorkspacePermissions.TeamManage));
        Assert.Equal(canWriteCollections, WorkspacePermissions.Can(member, WorkspacePermissions.CollectionWrite));
        Assert.Equal(canReadSecrets, WorkspacePermissions.Can(member, WorkspacePermissions.EnvironmentSecretRead));
        Assert.True(WorkspacePermissions.Can(member, WorkspacePermissions.CollectionRead));
    }

    [Fact]
    public void MultipleRolesCombinePermissionsWithoutDuplicates()
    {
        var member = Member(WorkspaceAccessRole.Developer, WorkspaceAccessRole.QA);
        var permissions = WorkspacePermissions.EffectivePermissions(WorkspacePermissions.RolesOf(member));

        Assert.Contains(WorkspacePermissions.CollectionWrite, permissions);
        Assert.Contains(WorkspacePermissions.EnvironmentRead, permissions);
        Assert.Equal(permissions.Count, permissions.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(
            permissions.OrderBy(permission => permission, StringComparer.Ordinal).ToArray(),
            permissions.ToArray());
    }

    [Fact]
    public async Task MissingPermissionIsForbiddenAndDoesNotGrantLegacyAdminAccess()
    {
        var workspaceId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var workspaces = Substitute.For<IWorkspaceRepository>();

        workspaces.FindMemberAsync(workspaceId, actorId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(new WorkspaceMember(
                workspaceId,
                actorId,
                WorkspaceRole.Admin,
                [WorkspaceAccessRole.QA])));

        var error = await Assert.ThrowsAsync<AppException>(() =>
            WorkspacePermissions.RequireAsync(
                workspaces,
                workspaceId,
                actorId,
                WorkspacePermissions.CollectionWrite,
                CancellationToken.None));

        Assert.Equal(403, error.StatusCode);
    }

    [Fact]
    public void WorkspaceAdminCannotModifyAnotherPrivilegedMember()
    {
        var actor = Member(WorkspaceAccessRole.WorkspaceAdmin);
        var target = Member(WorkspaceAccessRole.WorkspaceAdmin);

        var error = Assert.Throws<AppException>(() =>
            RoleDelegation.CheckCanModify(actor, target));

        Assert.Equal(403, error.StatusCode);
    }

    [Fact]
    public void TeamLeadCanModifyAnotherPrivilegedMember()
    {
        var actor = Member(WorkspaceAccessRole.TeamLead);
        var target = Member(WorkspaceAccessRole.WorkspaceAdmin);

        RoleDelegation.CheckCanModify(actor, target);
    }

    private static WorkspaceMember Member(params WorkspaceAccessRole[] roles)
    {
        return new WorkspaceMember(Guid.NewGuid(), Guid.NewGuid(), WorkspaceRole.Member, roles);
    }
}
