using NSubstitute;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.Handlers;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class RemoveWorkspaceMemberHandlerTests
{
    [Theory]
    [InlineData(WorkspaceAccessRole.TeamLead, WorkspaceAccessRole.Developer, true)]
    [InlineData(WorkspaceAccessRole.TeamLead, WorkspaceAccessRole.WorkspaceAdmin, true)]
    [InlineData(WorkspaceAccessRole.WorkspaceAdmin, WorkspaceAccessRole.QA, true)]
    [InlineData(WorkspaceAccessRole.WorkspaceAdmin, WorkspaceAccessRole.TeamLead, false)]
    [InlineData(WorkspaceAccessRole.WorkspaceAdmin, WorkspaceAccessRole.WorkspaceAdmin, false)]
    [InlineData(WorkspaceAccessRole.Developer, WorkspaceAccessRole.QA, false)]
    [InlineData(WorkspaceAccessRole.QA, WorkspaceAccessRole.Developer, false)]
    [InlineData(WorkspaceAccessRole.TechnicalWriter, WorkspaceAccessRole.Developer, false)]
    public async Task RemovalEnforcesExistingRoleDelegation(WorkspaceAccessRole actorRole,
        WorkspaceAccessRole targetRole, bool allowed)
    {
        var f = new Fixture(actorRole, targetRole);
        if (allowed)
        {
            await f.Handler.Handle(new(f.Actor, f.Workspace.Id, f.Target), CancellationToken.None);
            await f.Repository.Received(1).DeleteMemberAsync(f.Workspace.Id, f.Target, Arg.Any<CancellationToken>());
            await f.Scope.Received(1).CommitAsync(Arg.Any<CancellationToken>());
        }
        else
        {
            var error = await Assert.ThrowsAsync<AppException>(async () =>
                await f.Handler.Handle(new(f.Actor, f.Workspace.Id, f.Target), CancellationToken.None));
            Assert.Equal(403, error.StatusCode);
            await f.NoDelete();
        }
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task FounderAndSelfAreProtected(bool founder)
    {
        var f = new Fixture(WorkspaceAccessRole.TeamLead, WorkspaceAccessRole.Developer);
        var error = await Assert.ThrowsAsync<AppException>(async () =>
            await f.Handler.Handle(new(f.Actor, f.Workspace.Id, founder ? f.Workspace.OwnerUserId : f.Actor), CancellationToken.None));
        Assert.Equal(403, error.StatusCode);
        await f.NoDelete();
    }

    [Fact]
    public async Task CannotRemoveMemberFromAnotherWorkspace()
    {
        var f = new Fixture(WorkspaceAccessRole.TeamLead, WorkspaceAccessRole.Developer);
        var error = await Assert.ThrowsAsync<AppException>(async () =>
            await f.Handler.Handle(new(f.Actor, Guid.NewGuid(), f.Target), CancellationToken.None));
        Assert.Equal(403, error.StatusCode);
        await f.NoDelete();
    }

    [Fact]
    public async Task MissingTargetDoesNotDeleteAnything()
    {
        var f = new Fixture(WorkspaceAccessRole.TeamLead, WorkspaceAccessRole.Developer);
        var error = await Assert.ThrowsAsync<AppException>(async () =>
            await f.Handler.Handle(new(f.Actor, f.Workspace.Id, Guid.NewGuid()), CancellationToken.None));
        Assert.Equal(404, error.StatusCode);
        await f.NoDelete();
    }

    [Fact]
    public async Task ConcurrentRemovalDoesNotCommit()
    {
        var f = new Fixture(WorkspaceAccessRole.TeamLead, WorkspaceAccessRole.Developer);
        f.Repository.DeleteMemberAsync(f.Workspace.Id, f.Target, Arg.Any<CancellationToken>()).Returns(Task.FromResult(0));
        var error = await Assert.ThrowsAsync<AppException>(async () =>
            await f.Handler.Handle(new(f.Actor, f.Workspace.Id, f.Target), CancellationToken.None));
        Assert.Equal(409, error.StatusCode);
        await f.Scope.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
    }

    private sealed class Fixture
    {
        public readonly Guid Actor = Guid.NewGuid();
        public readonly Guid Target = Guid.NewGuid();
        public readonly Workspace Workspace = new("Removal test", Guid.NewGuid());
        public readonly IWorkspaceRepository Repository = Substitute.For<IWorkspaceRepository>();
        public readonly ITransactionScope Scope = Substitute.For<ITransactionScope>();
        public readonly RemoveWorkspaceMemberHandler Handler;

        public Fixture(WorkspaceAccessRole actorRole, WorkspaceAccessRole targetRole)
        {
            var manager = Substitute.For<ITransactionManager>();
            manager.BeginSerializableAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(Scope));
            Repository.FindAsync(Workspace.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<Workspace?>(Workspace));
            Repository.FindMemberAsync(Workspace.Id, Actor, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<WorkspaceMember?>(new WorkspaceMember(Workspace.Id, Actor, WorkspaceRole.Member, [actorRole])));
            Repository.FindMemberAsync(Workspace.Id, Target, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<WorkspaceMember?>(new WorkspaceMember(Workspace.Id, Target, WorkspaceRole.Member, [targetRole])));
            Repository.DeleteMemberAsync(Workspace.Id, Target, Arg.Any<CancellationToken>()).Returns(Task.FromResult(1));
            Handler = new(Repository, manager);
        }

        public async Task NoDelete()
        {
            await Repository.DidNotReceive().DeleteMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Scope.DidNotReceive().CommitAsync(Arg.Any<CancellationToken>());
        }
    }
}
