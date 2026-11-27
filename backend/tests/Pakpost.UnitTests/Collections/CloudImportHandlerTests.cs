using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Handlers;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class CloudImportHandlerTests
{
    [Fact]
    public async Task ValidBatchPersistsCollectionsRequestsAndFoldersOnce()
    {
        var context = MakeContext(WorkspaceAccessRole.Developer);
        var input = new CloudImportCollection(
            "Service API",
            [],
            [
                new CloudImportRequest(
                    "Login",
                    "POST",
                    "https://api.example.test/login",
                    "{}",
                    "",
                    FolderPath: ["Authentication", "Accounts"]),
                new CloudImportRequest(
                    "Profile",
                    "GET",
                    "https://api.example.test/profile",
                    "{}",
                    "",
                    FolderPath: ["Authentication"])
            ]);

        var result = await context.Handler.Handle(
            new ImportCollectionsCommand(context.ActorId, context.WorkspaceId, [input]),
            CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal(1, result.CreatedCount);
        context.Collections.Received(1).Add(Arg.Any<Collection>());
        context.Requests.Received(2).Add(Arg.Any<SavedRequest>());
        context.Folders.Received(2).Add(Arg.Any<CollectionFolder>());
        context.Revisions.Received(2).Add(Arg.Any<SavedRequestRevision>());
        await context.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ImportedCollectionScriptsAreStoredSeparately()
    {
        var context = MakeContext(WorkspaceAccessRole.Developer);
        var input = new CloudImportCollection("Synthetic", [],
            [new CloudImportRequest("Ping", "GET", "https://example.test", "{}", "")],
            PreScript: "function helper(x){return x;}", PostScript: "pm.test('ok',()=>{});");
        await context.Handler.Handle(new ImportCollectionsCommand(context.ActorId, context.WorkspaceId, [input]), CancellationToken.None);
        context.Collections.Received(1).Add(Arg.Is<Collection>(c => c.ScriptsJson != null && c.ScriptsJson.Contains("helper")));
        await context.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OversizedCollectionScriptDoesNotCommit()
    {
        var context = MakeContext(WorkspaceAccessRole.Developer);
        var input = new CloudImportCollection("Synthetic", [], [], PreScript: new string('x', 64001));
        await Assert.ThrowsAsync<AppException>(async () =>
            await context.Handler.Handle(new ImportCollectionsCommand(context.ActorId, context.WorkspaceId, [input]), CancellationToken.None));
        await context.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task InvalidSecondRequestDoesNotCommitPartialBatch()
    {
        var context = MakeContext(WorkspaceAccessRole.Developer);
        var input = new CloudImportCollection(
            "Service API",
            [],
            [
                new CloudImportRequest("Valid", "GET", "https://api.example.test", "{}", ""),
                new CloudImportRequest("Invalid", "TRACE", "https://api.example.test", "{}", "")
            ]);

        var error = await Assert.ThrowsAsync<AppException>(async () =>
        {
            await context.Handler.Handle(
                new ImportCollectionsCommand(context.ActorId, context.WorkspaceId, [input]),
                CancellationToken.None);
        });

        Assert.Equal(400, error.StatusCode);
        await context.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task QaCannotStageOrCommitImport()
    {
        var context = MakeContext(WorkspaceAccessRole.QA);
        var input = new CloudImportCollection("Restricted", [], []);

        var error = await Assert.ThrowsAsync<AppException>(async () =>
        {
            await context.Handler.Handle(
                new ImportCollectionsCommand(context.ActorId, context.WorkspaceId, [input]),
                CancellationToken.None);
        });

        Assert.Equal(403, error.StatusCode);
        context.Collections.DidNotReceive().Add(Arg.Any<Collection>());
        await context.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    private static TestContext MakeContext(WorkspaceAccessRole role)
    {
        var workspaceId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var workspaces = Substitute.For<IWorkspaceRepository>();
        var collections = Substitute.For<ICollectionRepository>();
        var requests = Substitute.For<ISavedRequestRepository>();
        var revisions = Substitute.For<ISavedRequestRevisionRepository>();
        var folders = Substitute.For<ICollectionFolderRepository>();
        var cipher = Substitute.For<IEnvironmentValueCipher>();
        var unitOfWork = Substitute.For<IUnitOfWork>();

        workspaces.FindMemberAsync(workspaceId, actorId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<WorkspaceMember?>(
                new WorkspaceMember(workspaceId, actorId, WorkspaceRole.Member, [role])));

        cipher.Protect(Arg.Any<string>())
            .Returns(call => call.Arg<string>());

        unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(1));

        var handler = new ImportCollectionsHandler(
            workspaces,
            collections,
            requests,
            revisions,
            cipher,
            unitOfWork,
            folders);

        return new TestContext(
            workspaceId,
            actorId,
            handler,
            collections,
            requests,
            revisions,
            folders,
            unitOfWork);
    }

    private sealed record TestContext(
        Guid WorkspaceId,
        Guid ActorId,
        ImportCollectionsHandler Handler,
        ICollectionRepository Collections,
        ISavedRequestRepository Requests,
        ISavedRequestRevisionRepository Revisions,
        ICollectionFolderRepository Folders,
        IUnitOfWork UnitOfWork);
}
