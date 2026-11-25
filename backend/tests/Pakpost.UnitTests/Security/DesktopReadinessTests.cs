using NSubstitute;
using Pakpost.Api.Security;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests.Security;

public sealed class DesktopReadinessTests
{
    [Fact]
    public void PairingRequiresSecretAndCanOnlyBeConsumedOnce()
    {
        var store = new DesktopPairingStore();
        var pair = store.Start();
        var user = Guid.NewGuid();
        Assert.Equal(DesktopPairingStore.Status.Pending,
            store.Consume(pair.RequestId, pair.DeviceSecret, out _, out _));
        Assert.True(store.Approve(pair.RequestId, user, "https://example.test/avatar.png"));
        Assert.False(store.Approve(pair.RequestId, Guid.NewGuid(), null));
        Assert.Equal(DesktopPairingStore.Status.Invalid,
            store.Consume(pair.RequestId, ServerSessionStore.RandomProof(), out _, out _));
        Assert.Equal(DesktopPairingStore.Status.Approved,
            store.Consume(pair.RequestId, pair.DeviceSecret, out var approved, out var avatar));
        Assert.Equal(user, approved);
        Assert.Equal("https://example.test/avatar.png", avatar);
        Assert.Equal(DesktopPairingStore.Status.Invalid,
            store.Consume(pair.RequestId, pair.DeviceSecret, out _, out _));
    }

    [Fact]
    public async Task ConcurrentPairingConsumptionHasExactlyOneWinner()
    {
        var store = new DesktopPairingStore();
        var pair = store.Start();
        Assert.True(store.Approve(pair.RequestId, Guid.NewGuid(), null));
        var attempts = await Task.WhenAll(Enumerable.Range(0, 16).Select(_ => Task.Run(() =>
            store.Consume(pair.RequestId, pair.DeviceSecret, out var userId, out var avatarUrl))));
        Assert.Single(attempts.Where(status => status == DesktopPairingStore.Status.Approved));
        Assert.Equal(15, attempts.Count(status => status == DesktopPairingStore.Status.Invalid));
    }

    [Fact]
    public async Task WorkspacePermissionIsScopedToWorkspaceAndAccount()
    {
        var repo = Substitute.For<IWorkspaceRepository>();
        var workspace = Guid.NewGuid();
        var account = Guid.NewGuid();
        var member = new WorkspaceMember(workspace, account, WorkspaceRole.Member,
            new[] { WorkspaceAccessRole.QA });
        repo.FindMemberAsync(workspace, account, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(member));
        repo.FindMemberAsync(workspace, Arg.Is<Guid>(id => id != account), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(null));
        repo.FindMemberAsync(Arg.Is<Guid>(id => id != workspace), account, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(null));
        Assert.Same(member, await WorkspacePermissions.RequireAsync(repo, workspace, account,
            WorkspacePermissions.CollectionRead, CancellationToken.None));
        await Assert.ThrowsAsync<AppException>(() => WorkspacePermissions.RequireAsync(repo, workspace,
            Guid.NewGuid(), WorkspacePermissions.CollectionRead, CancellationToken.None));
        await Assert.ThrowsAsync<AppException>(() => WorkspacePermissions.RequireAsync(repo, Guid.NewGuid(),
            account, WorkspacePermissions.CollectionRead, CancellationToken.None));
        await Assert.ThrowsAsync<AppException>(() => WorkspacePermissions.RequireAsync(repo, workspace,
            account, WorkspacePermissions.CollectionWrite, CancellationToken.None));
    }
}
