using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class CrossAccountIsolationTests
{
    [Fact]
    public async Task WorkspaceOwnerCannotTransferPermissionsToAnotherAccountOrWorkspace()
    {
        var workspace = Guid.NewGuid();
        var owner = Guid.NewGuid();
        var outsider = Guid.NewGuid();
        var otherWorkspace = Guid.NewGuid();
        var members = Substitute.For<IWorkspaceRepository>();
        members.FindMemberAsync(workspace, owner, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(new WorkspaceMember(workspace, owner, WorkspaceRole.Owner)));
        members.FindMemberAsync(workspace, outsider, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(null));
        members.FindMemberAsync(otherWorkspace, owner, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(null));
        await WorkspacePermissions.RequireAsync(members, workspace, owner, WorkspacePermissions.CollectionWrite, CancellationToken.None);
        foreach (var permission in new[] { WorkspacePermissions.CollectionRead, WorkspacePermissions.CollectionWrite, WorkspacePermissions.EnvironmentSecretRead, WorkspacePermissions.TeamManage })
        {
            await Assert.ThrowsAsync<AppException>(() => WorkspacePermissions.RequireAsync(members, workspace, outsider, permission, CancellationToken.None));
            await Assert.ThrowsAsync<AppException>(() => WorkspacePermissions.RequireAsync(members, otherWorkspace, owner, permission, CancellationToken.None));
        }
    }
}
