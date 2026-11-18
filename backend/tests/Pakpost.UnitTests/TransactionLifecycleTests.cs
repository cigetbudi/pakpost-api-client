using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.Handlers;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class TransactionLifecycleTests
{
    [Fact]
    public async Task RecursiveDeleteCommitsOnlyAfterAllDeletesAreSaved()
    {
        var context = CreateContext();
        var parent = new CollectionFolder(context.Collection.Id, null, "Root");
        var child = new CollectionFolder(context.Collection.Id, parent.Id, "Child");
        var request = new SavedRequest(
            context.Collection.Id,
            "List",
            "GET",
            "https://api.example.test",
            "{}",
            "",
            folderId: child.Id);

        context.Folders.ListAsync(context.Collection.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<CollectionFolder>>([parent, child]));

        context.Requests.ListAsync(context.Collection.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<SavedRequest>>([request]));

        var removedRequests = new List<SavedRequest>();
        var removedFolders = new List<CollectionFolder>();
        var saved = false;

        context.Requests.When(repository => repository.Remove(Arg.Any<SavedRequest>()))
            .Do(call => removedRequests.Add(call.Arg<SavedRequest>()));

        context.Folders.When(repository => repository.Remove(Arg.Any<CollectionFolder>()))
            .Do(call => removedFolders.Add(call.Arg<CollectionFolder>()));

        context.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                Assert.Single(removedRequests);
                Assert.Equal(2, removedFolders.Count);
                saved = true;
                return Task.FromResult(3);
            });

        context.Transaction.CommitAsync(Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                Assert.True(saved);
                return Task.CompletedTask;
            });

        var handler = context.CreateDeleteHandler();

        await handler.Handle(
            new DeleteFolderItemsCommand(
                context.ActorId,
                context.WorkspaceId,
                context.Collection.Id,
                [new(parent.Id, parent.Version)],
                []),
            CancellationToken.None);

        await context.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await context.Transaction.Received(1).CommitAsync(Arg.Any<CancellationToken>());
        await context.Transaction.Received(1).DisposeAsync();
    }

    [Fact]
    public async Task AFailedSaveNeverCommitsAndDisposesTransaction()
    {
        var context = CreateContext();
        var folder = new CollectionFolder(context.Collection.Id, null, "Root");

        context.Folders.ListAsync(context.Collection.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<CollectionFolder>>([folder]));

        context.Requests.ListAsync(context.Collection.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<SavedRequest>>([]));

        context.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromException<int>(new InvalidOperationException("Save failed")));

        var handler = context.CreateDeleteHandler();

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await handler.Handle(
                new DeleteFolderItemsCommand(
                    context.ActorId,
                    context.WorkspaceId,
                    context.Collection.Id,
                    [new(folder.Id, folder.Version)],
                    []),
                CancellationToken.None);
        });

        await context.Transaction.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
        await context.Transaction.Received(1).DisposeAsync();
    }

    [Fact]
    public async Task StaleFolderVersionNeverCommits()
    {
        var context = CreateContext();
        var folder = new CollectionFolder(context.Collection.Id, null, "Root");

        context.Folders.ListAsync(context.Collection.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<CollectionFolder>>([folder]));

        var handler = context.CreateDeleteHandler();

        var error = await Assert.ThrowsAsync<AppException>(async () =>
        {
            await handler.Handle(
                new DeleteFolderItemsCommand(
                    context.ActorId,
                    context.WorkspaceId,
                    context.Collection.Id,
                    [new(folder.Id, folder.Version + 1)],
                    []),
                CancellationToken.None);
        });

        Assert.Equal(409, error.StatusCode);
        await context.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        await context.Transaction.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
        await context.Transaction.Received(1).DisposeAsync();
    }

    private static TestContext CreateContext()
    {
        var workspaceId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var collection = new Collection(workspaceId, "API", actorId);
        var workspaces = Substitute.For<IWorkspaceRepository>();
        var collections = Substitute.For<ICollectionRepository>();
        var folders = Substitute.For<ICollectionFolderRepository>();
        var requests = Substitute.For<ISavedRequestRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var transactions = Substitute.For<ITransactionManager>();
        var transaction = Substitute.For<ITransactionScope>();

        workspaces.FindMemberAsync(workspaceId, actorId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(
                new WorkspaceMember(
                    workspaceId,
                    actorId,
                    WorkspaceRole.Member,
                    [WorkspaceAccessRole.Developer])));

        collections.FindAsync(collection.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Collection?>(collection));

        transactions.BeginSerializableAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(transaction));

        transaction.CommitAsync(Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        return new TestContext(
            workspaceId,
            actorId,
            collection,
            workspaces,
            collections,
            folders,
            requests,
            unitOfWork,
            transactions,
            transaction);
    }

    private sealed record TestContext(
        Guid WorkspaceId,
        Guid ActorId,
        Collection Collection,
        IWorkspaceRepository Workspaces,
        ICollectionRepository Collections,
        ICollectionFolderRepository Folders,
        ISavedRequestRepository Requests,
        IUnitOfWork UnitOfWork,
        ITransactionManager Transactions,
        ITransactionScope Transaction)
    {
        public DeleteFolderItemsHandler CreateDeleteHandler() => new(
            Workspaces,
            Collections,
            Folders,
            Requests,
            UnitOfWork,
            Transactions);
    }
}
