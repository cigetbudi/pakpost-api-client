using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.UnitTests;

public sealed class DomainVersionTests
{
    [Fact]
    public void NewRequestStartsAtRevisionOneAndEachModificationAdvancesOnce()
    {
        var request = new SavedRequest(
            Guid.NewGuid(),
            "List",
            "get",
            " https://api.example.test ",
            "{}",
            "");

        Assert.Equal(1, request.Revision);
        Assert.Equal("GET", request.Method);
        Assert.Equal("https://api.example.test", request.Url);

        request.Update("Updated", "post", "https://api.example.test", "{}", "{}");
        Assert.Equal(2, request.Revision);

        var destination = Guid.NewGuid();
        var folder = Guid.NewGuid();
        request.MoveTo(destination, folder);

        Assert.Equal(3, request.Revision);
        Assert.Equal(destination, request.CollectionId);
        Assert.Equal<Guid?>(folder, request.FolderId);
    }

    [Fact]
    public void CollectionVariablesAdvanceTheirConcurrencyVersion()
    {
        var collection = new Collection(Guid.NewGuid(), "API", Guid.NewGuid());

        Assert.Equal(0, collection.VariablesVersion);

        collection.SetVariables("[]");
        collection.SetVariables("[]");

        Assert.Equal(2, collection.VariablesVersion);
    }

    [Fact]
    public void FolderMutationsAdvanceTheirConcurrencyVersion()
    {
        var folder = new CollectionFolder(Guid.NewGuid(), null, "Root");

        folder.Rename("Updated");
        folder.Move(Guid.NewGuid());

        Assert.Equal(3, folder.Version);
    }

    [Fact]
    public void AcceptedInvitationCannotBeResentOrRevoked()
    {
        var now = DateTimeOffset.UtcNow;
        var invitation = new WorkspaceInvitation(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "PERSON@example.test",
            [WorkspaceAccessRole.Developer],
            "placeholder-hash",
            now);

        Assert.Equal("person@example.test", invitation.Email);
        Assert.Equal(1, invitation.Version);

        invitation.Accept(now.AddMinutes(1));

        Assert.Equal(2, invitation.Version);
        Assert.False(invitation.IsPending(now.AddMinutes(2)));
        Assert.Throws<InvalidOperationException>(() => invitation.Resend("other-hash", now.AddMinutes(2)));
        Assert.Throws<InvalidOperationException>(() => invitation.Revoke(now.AddMinutes(2)));
    }
}
