using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.Handlers;
using Pakpost.Domain.Entities;

namespace Pakpost.UnitTests;

public sealed class DeleteWorkspaceHandlerTests
{
    [Fact]
    public async Task FounderCanDeleteWorkspaceAndCommitsExactlyOnce()
    {
        var founderId = Guid.NewGuid();
        var workspace = new Workspace("Founder workspace", founderId);
        var repository = Substitute.For<IWorkspaceRepository>();
        var manager = Substitute.For<ITransactionManager>();
        var scope = Substitute.For<ITransactionScope>();

        manager.BeginSerializableAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(scope));

        repository.FindAsync(workspace.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Workspace?>(workspace));

        repository.DeleteOwnedAsync(workspace.Id, founderId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(1));

        var handler = new DeleteWorkspaceHandler(repository, manager);

        await handler.Handle(
            new DeleteWorkspaceCommand(founderId, workspace.Id),
            CancellationToken.None);

        await repository.Received(1).DeleteOwnedAsync(
            workspace.Id,
            founderId,
            Arg.Any<CancellationToken>());

        await scope.Received(1).CommitAsync(Arg.Any<CancellationToken>());
        await scope.Received(1).DisposeAsync();
    }

    [Fact]
    public async Task WorkspaceAdminCannotDeleteWorkspaceOwnedByAnotherUser()
    {
        var workspace = new Workspace("Protected workspace", Guid.NewGuid());
        var repository = Substitute.For<IWorkspaceRepository>();
        var manager = Substitute.For<ITransactionManager>();
        var scope = Substitute.For<ITransactionScope>();

        manager.BeginSerializableAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(scope));

        repository.FindAsync(workspace.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Workspace?>(workspace));

        var handler = new DeleteWorkspaceHandler(repository, manager);

        var error = await Assert.ThrowsAsync<AppException>(async () =>
        {
            await handler.Handle(
                new DeleteWorkspaceCommand(Guid.NewGuid(), workspace.Id),
                CancellationToken.None);
        });

        Assert.Equal(403, error.StatusCode);
        await repository.DidNotReceive().DeleteOwnedAsync(
            Arg.Any<Guid>(),
            Arg.Any<Guid>(),
            Arg.Any<CancellationToken>());

        await scope.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task MissingWorkspaceReturnsNotFound()
    {
        var repository = Substitute.For<IWorkspaceRepository>();
        var manager = Substitute.For<ITransactionManager>();
        var scope = Substitute.For<ITransactionScope>();

        manager.BeginSerializableAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(scope));

        var handler = new DeleteWorkspaceHandler(repository, manager);

        var error = await Assert.ThrowsAsync<AppException>(async () =>
        {
            await handler.Handle(
                new DeleteWorkspaceCommand(Guid.NewGuid(), Guid.NewGuid()),
                CancellationToken.None);
        });

        Assert.Equal(404, error.StatusCode);
        await scope.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ConcurrentDeletionDoesNotCommit()
    {
        var founderId = Guid.NewGuid();
        var workspace = new Workspace("Changed workspace", founderId);
        var repository = Substitute.For<IWorkspaceRepository>();
        var manager = Substitute.For<ITransactionManager>();
        var scope = Substitute.For<ITransactionScope>();

        manager.BeginSerializableAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(scope));

        repository.FindAsync(workspace.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Workspace?>(workspace));

        repository.DeleteOwnedAsync(workspace.Id, founderId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(0));

        var handler = new DeleteWorkspaceHandler(repository, manager);

        var error = await Assert.ThrowsAsync<AppException>(async () =>
        {
            await handler.Handle(
                new DeleteWorkspaceCommand(founderId, workspace.Id),
                CancellationToken.None);
        });

        Assert.Equal(409, error.StatusCode);
        await scope.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }
}
