using NSubstitute;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Handlers;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class CollectionReadOptimizationTests
{
    [Fact]
    public async Task ListCollectionsUsesMetadataProjectionWithoutDecryptingVariables()
    {
        var workspaceId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var collectionId = Guid.NewGuid();
        var workspaces = Substitute.For<IWorkspaceRepository>();
        var collections = Substitute.For<ICollectionRepository>();

        workspaces.FindMemberAsync(workspaceId, actorId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(
                new WorkspaceMember(workspaceId, actorId, WorkspaceRole.Owner)));

        collections.ListOverviewAsync(workspaceId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<CollectionOverview>>(
                [new CollectionOverview(collectionId, workspaceId, "API", 1234)]));

        var handler = new ListCollectionsHandler(collections, workspaces);
        var result = await handler.Handle(new ListCollectionsQuery(actorId, workspaceId), CancellationToken.None);

        var item = Assert.Single(result);
        Assert.Equal(collectionId, item.Id);
        Assert.Equal(1234, item.RequestCount);
        await collections.Received(1).ListOverviewAsync(workspaceId, Arg.Any<CancellationToken>());
        await collections.DidNotReceive().ListAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await collections.DidNotReceive().CountRequestsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }
}
