using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Handlers;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class CloudRequestIndexTests
{
    [Fact]
    public async Task IndexUsesLightweightRepositoryAndPreservesFolderAndRevision()
    {
        var (actor, workspace, collection, members, collections, requests) = Setup();
        var requestId = Guid.NewGuid();
        var folderId = Guid.NewGuid();
        requests.ListIndexAsync(collection, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<SavedRequestIndex>>([
                new SavedRequestIndex(requestId, collection, folderId, 7, "Get user", "GET", "https://example.com", "{}")
            ]));

        var handler = new ListSavedRequestIndexHandler(members, collections, requests);
        var results = await handler.Handle(new ListSavedRequestIndexQuery(actor, workspace, collection), CancellationToken.None);

        var item = Assert.Single(results);
        Assert.Equal(requestId, item.Id);
        Assert.Equal(folderId, item.FolderId);
        Assert.Equal(7, item.Revision);
        Assert.True(item.IsIndex);
        await requests.Received(1).ListIndexAsync(collection, Arg.Any<CancellationToken>());
        await requests.DidNotReceive().ListAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DetailsUseCollectionScopedLookupInsteadOfUnrestrictedFind()
    {
        var (actor, workspace, collection, members, collections, requests) = Setup();
        var requestId = Guid.NewGuid();
        requests.FindInCollectionAsync(requestId, collection, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<SavedRequest?>(null));

        var handler = new GetSavedRequestHandler(members, collections, requests);
        var error = await Assert.ThrowsAsync<AppException>(async () =>
            await handler.Handle(new GetSavedRequestQuery(actor, workspace, collection, requestId), CancellationToken.None));

        Assert.Equal(404, error.StatusCode);
        await requests.Received(1).FindInCollectionAsync(requestId, collection, Arg.Any<CancellationToken>());
        await requests.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task IndexDoesNotReadAnotherWorkspaceCollection()
    {
        var (actor, workspace, collection, members, collections, requests) = Setup(false);
        var handler = new ListSavedRequestIndexHandler(members, collections, requests);
        var error = await Assert.ThrowsAsync<AppException>(async () =>
            await handler.Handle(new ListSavedRequestIndexQuery(actor, workspace, collection), CancellationToken.None));

        Assert.Equal(404, error.StatusCode);
        await requests.DidNotReceive().ListIndexAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HistoryIndexDoesNotLoadRequestOrEncryptedSnapshots()
    {
        var (actor, workspace, collection, members, collections, requests) = Setup();
        var requestId = Guid.NewGuid();
        var revisions = Substitute.For<ISavedRequestRevisionRepository>();
        requests.ExistsInCollectionAsync(requestId, collection, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(true));
        revisions.ListOverviewAsync(requestId, 50, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<SavedRequestRevisionOverview>>([
                new SavedRequestRevisionOverview(5, "updated", actor, DateTimeOffset.UtcNow)
            ]));

        var handler = new ListSavedRequestHistoryHandler(members, collections, requests, revisions);
        var result = await handler.Handle(new ListSavedRequestHistoryQuery(actor, workspace, collection, requestId), CancellationToken.None);

        Assert.Equal(5, Assert.Single(result).Revision);
        await requests.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await revisions.DidNotReceive().ListAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    private static (Guid Actor, Guid Workspace, Guid Collection,
        IWorkspaceRepository Members, ICollectionRepository Collections, ISavedRequestRepository Requests)
        Setup(bool visible = true)
    {
        var actor = Guid.NewGuid();
        var workspace = Guid.NewGuid();
        var collection = Guid.NewGuid();
        var members = Substitute.For<IWorkspaceRepository>();
        var collections = Substitute.For<ICollectionRepository>();
        var requests = Substitute.For<ISavedRequestRepository>();

        members.FindMemberAsync(workspace, actor, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(new WorkspaceMember(workspace, actor, WorkspaceRole.Owner)));
        collections.ExistsInWorkspaceAsync(collection, workspace, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(visible));
        return (actor, workspace, collection, members, collections, requests);
    }
}
