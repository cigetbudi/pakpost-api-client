using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.Handlers;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class CloudFolderHandlerTests
{
    [Fact]
    public async Task CreateFolderPersistsOnceForDeveloper()
    {
        var context = MakeContext(WorkspaceAccessRole.Developer);
        var saved = new List<CollectionFolder>();

        context.Folders.ListAsync(context.Collection.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<CollectionFolder>>([]));

        context.Folders.When(repository => repository.Add(Arg.Any<CollectionFolder>()))
            .Do(call => saved.Add(call.Arg<CollectionFolder>()));

        var handler = new CreateFolderHandler(
            context.Workspaces,
            context.Collections,
            context.Folders,
            context.UnitOfWork,
            context.Transactions);

        var command = new CreateFolderCommand(
            context.ActorId,
            context.WorkspaceId,
            context.Collection.Id,
            null,
            "Authentication");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Authentication", result.Name);
        Assert.Single(saved);

        await context.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await context.Transaction.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task QaCannotCreateCloudFolderOrPersistChanges()
    {
        var context = MakeContext(WorkspaceAccessRole.QA);
        var handler = new CreateFolderHandler(
            context.Workspaces,
            context.Collections,
            context.Folders,
            context.UnitOfWork,
            context.Transactions);

        var command = new CreateFolderCommand(
            context.ActorId,
            context.WorkspaceId,
            context.Collection.Id,
            null,
            "Restricted");

        var error = await Assert.ThrowsAsync<AppException>(async () =>
        {
            await handler.Handle(command, CancellationToken.None);
        });

        Assert.Equal(403, error.StatusCode);
        context.Folders.DidNotReceive().Add(Arg.Any<CollectionFolder>());
        await context.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        await context.Transaction.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task MoveFolderRejectsStaleVersionWithoutSaving()
    {
        var context = MakeContext(WorkspaceAccessRole.Developer);
        var folder = new CollectionFolder(context.Collection.Id, null, "Accounts");

        context.Folders.FindAsync(folder.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<CollectionFolder?>(folder));

        var handler = new MoveFolderHandler(
            context.Workspaces,
            context.Collections,
            context.Folders,
            context.UnitOfWork,
            context.Transactions,
            Substitute.For<ISavedRequestRepository>());

        var command = new MoveFolderCommand(
            context.ActorId,
            context.WorkspaceId,
            context.Collection.Id,
            folder.Id,
            null,
            999);

        var error = await Assert.ThrowsAsync<AppException>(async () =>
        {
            await handler.Handle(command, CancellationToken.None);
        });

        Assert.Equal(409, error.StatusCode);
        await context.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        await context.Transaction.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }

    private static TestContext MakeContext(WorkspaceAccessRole role)
    {
        var workspaceId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var collection = new Collection(workspaceId, "API", actorId);
        var workspaces = Substitute.For<IWorkspaceRepository>();
        var collections = Substitute.For<ICollectionRepository>();
        var folders = Substitute.For<ICollectionFolderRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var transactions = Substitute.For<ITransactionManager>();
        var transaction = Substitute.For<ITransactionScope>();

        transactions.BeginSerializableAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(transaction));

        transaction.CommitAsync(Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        workspaces.FindMemberAsync(workspaceId, actorId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(
                new WorkspaceMember(workspaceId, actorId, WorkspaceRole.Member, [role])));

        collections.ExistsInWorkspaceAsync(collection.Id, workspaceId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(true));

        unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(1));

        return new TestContext(
            workspaceId,
            actorId,
            collection,
            workspaces,
            collections,
            folders,
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
        IUnitOfWork UnitOfWork,
        ITransactionManager Transactions,
        ITransactionScope Transaction);
}
