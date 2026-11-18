using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Services;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class SavedRequestAccessTests
{
    [Fact]
    public async Task QaMayReadRequestsButCannotWrite()
    {
        var workspaceId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var collection = new Collection(workspaceId, "API", actorId);
        var workspaces = Substitute.For<IWorkspaceRepository>();
        var collections = Substitute.For<ICollectionRepository>();

        workspaces.FindMemberAsync(workspaceId, actorId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(
                new WorkspaceMember(workspaceId, actorId, WorkspaceRole.Member, [WorkspaceAccessRole.QA])));

        collections.FindAsync(collection.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Collection?>(collection));

        await SavedRequestsAccess.Check(
            actorId,
            workspaceId,
            collection.Id,
            workspaces,
            collections,
            CancellationToken.None);

        var error = await Assert.ThrowsAsync<AppException>(() =>
            SavedRequestsAccess.Check(
                actorId,
                workspaceId,
                collection.Id,
                workspaces,
                collections,
                CancellationToken.None,
                destructive: true));

        Assert.Equal(403, error.StatusCode);
    }

    [Fact]
    public async Task CollectionFromOtherWorkspaceIsNotAccessible()
    {
        var workspaceId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var otherCollection = new Collection(Guid.NewGuid(), "Other", actorId);
        var workspaces = Substitute.For<IWorkspaceRepository>();
        var collections = Substitute.For<ICollectionRepository>();

        workspaces.FindMemberAsync(workspaceId, actorId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(
                new WorkspaceMember(workspaceId, actorId, WorkspaceRole.Owner)));

        collections.FindAsync(otherCollection.Id, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Collection?>(otherCollection));

        var error = await Assert.ThrowsAsync<AppException>(() =>
            SavedRequestsAccess.Check(
                actorId,
                workspaceId,
                otherCollection.Id,
                workspaces,
                collections,
                CancellationToken.None));

        Assert.Equal(404, error.StatusCode);
    }
}
