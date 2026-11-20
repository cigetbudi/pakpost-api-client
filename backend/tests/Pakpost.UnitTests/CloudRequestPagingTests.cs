using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Handlers;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class CloudRequestPagingTests
{
    [Fact]
    public async Task PageUsesLightweightRepositoryAndIncludesNextCursor()
    {
        var (actor, workspace, collection, workspaces, collections, requests) = Setup();
        var requestId = Guid.NewGuid();
        var cursor = Guid.NewGuid().ToString("N");
        requests.PageIndexAsync(collection, 120, null, null, "user", null, false, false,
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new SavedRequestIndexPage([
                new SavedRequestIndex(requestId, collection, null, 3, "User", "GET", "https://example.com", "{}")
            ], cursor, true)));

        var page = await new PageSavedRequestIndexHandler(workspaces, collections, requests)
            .Handle(new PageSavedRequestIndexQuery(actor, workspace, collection, 120, null, "user"), CancellationToken.None);

        Assert.True(page.HasMore);
        Assert.Equal(cursor, page.NextCursor);
        Assert.Equal(requestId, Assert.Single(page.Items).Id);
        await requests.DidNotReceive().ListAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await requests.DidNotReceive().ListIndexAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(0, null)]
    [InlineData(201, null)]
    [InlineData(120, "not-a-uuid")]
    public async Task InvalidPageInputsReturnBadRequest(int size, string? cursor)
    {
        var (actor, workspace, collection, workspaces, collections, requests) = Setup();
        var handler = new PageSavedRequestIndexHandler(workspaces, collections, requests);
        var error = await Assert.ThrowsAsync<AppException>(async () =>
            await handler.Handle(new PageSavedRequestIndexQuery(actor, workspace, collection,
                size, cursor), CancellationToken.None));
        Assert.Equal(400, error.StatusCode);
        await requests.DidNotReceive().PageIndexAsync(Arg.Any<Guid>(), Arg.Any<int>(),
            Arg.Any<Guid?>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<bool>(), Arg.Any<bool>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PageRejectsAnotherWorkspaceCollection()
    {
        var (actor, workspace, collection, workspaces, collections, requests) = Setup(false);
        var handler = new PageSavedRequestIndexHandler(workspaces, collections, requests);
        var error = await Assert.ThrowsAsync<AppException>(async () =>
            await handler.Handle(new PageSavedRequestIndexQuery(actor, workspace, collection), CancellationToken.None));
        Assert.Equal(404, error.StatusCode);
        await requests.DidNotReceive().PageIndexAsync(Arg.Any<Guid>(), Arg.Any<int>(),
            Arg.Any<Guid?>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<bool>(), Arg.Any<bool>(),
            Arg.Any<CancellationToken>());
    }

    private static (Guid Actor, Guid Workspace, Guid Collection,
        IWorkspaceRepository Workspaces, ICollectionRepository Collections, ISavedRequestRepository Requests)
        Setup(bool visible = true)
    {
        var actor = Guid.NewGuid();
        var workspace = Guid.NewGuid();
        var collection = Guid.NewGuid();
        var workspaces = Substitute.For<IWorkspaceRepository>();
        var collections = Substitute.For<ICollectionRepository>();
        var requests = Substitute.For<ISavedRequestRepository>();
        workspaces.FindMemberAsync(workspace, actor, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(
                new WorkspaceMember(workspace, actor, WorkspaceRole.Owner)));
        collections.ExistsInWorkspaceAsync(collection, workspace, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(visible));
        return (actor, workspace, collection, workspaces, collections, requests);
    }
}
