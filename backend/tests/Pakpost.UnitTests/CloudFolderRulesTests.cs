using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Internal.Collections.Services;
using Pakpost.Domain.Entities;

namespace Pakpost.UnitTests;

public sealed class CloudFolderRulesTests
{
    [Fact]
    public void DuplicateSiblingNamesAreRejectedIgnoringCaseAndWhitespace()
    {
        var collectionId = Guid.NewGuid();
        var folder = new CollectionFolder(collectionId, null, "Authentication");

        var error = Assert.Throws<AppException>(() =>
            CloudFolderRules.ValidatePlacement(
                [folder],
                collectionId,
                null,
                " authentication "));

        Assert.Equal(409, error.StatusCode);
    }

    [Fact]
    public void AFolderCannotBeMovedIntoItsDescendant()
    {
        var collectionId = Guid.NewGuid();
        var root = new CollectionFolder(collectionId, null, "Root");
        var child = new CollectionFolder(collectionId, root.Id, "Child");

        var error = Assert.Throws<AppException>(() =>
            CloudFolderRules.ValidateMove(
                [root, child],
                collectionId,
                child.Id,
                root));

        Assert.Equal(400, error.StatusCode);
    }

    [Fact]
    public void MovingADeepSubtreeBeyondTheLimitIsRejected()
    {
        var collectionId = Guid.NewGuid();
        var movingRoot = new CollectionFolder(collectionId, null, "Move");
        var movingChild = new CollectionFolder(collectionId, movingRoot.Id, "Child");
        var folders = new List<CollectionFolder> { movingRoot, movingChild };
        Guid? parent = null;

        for (var index = 0; index < 23; index++)
        {
            var ancestor = new CollectionFolder(collectionId, parent, $"Ancestor {index}");
            folders.Add(ancestor);
            parent = ancestor.Id;
        }

        var error = Assert.Throws<AppException>(() =>
            CloudFolderRules.ValidateMove(folders, collectionId, parent, movingRoot));

        Assert.Equal(400, error.StatusCode);
    }

    [Fact]
    public void CreatingFolderAtDepthTwentyFiveIsRejected()
    {
        var collectionId = Guid.NewGuid();
        var folders = new List<CollectionFolder>();
        Guid? parent = null;

        for (var index = 0; index < 24; index++)
        {
            var folder = new CollectionFolder(collectionId, parent, $"Level {index + 1}");
            folders.Add(folder);
            parent = folder.Id;
        }

        var error = Assert.Throws<AppException>(() =>
            CloudFolderRules.ValidatePlacement(folders, collectionId, parent, "Too deep"));

        Assert.Equal(400, error.StatusCode);
    }

    [Fact]
    public void DeletingSelectedParentAlsoSelectsAllNestedFolders()
    {
        var collectionId = Guid.NewGuid();
        var root = new CollectionFolder(collectionId, null, "Root");
        var child = new CollectionFolder(collectionId, root.Id, "Child");
        var grandchild = new CollectionFolder(collectionId, child.Id, "Grandchild");
        var unrelated = new CollectionFolder(collectionId, null, "Other");

        var expanded = CloudFolderRules.ExpandSubtrees(
            [root, child, grandchild, unrelated],
            [root.Id, child.Id]);

        Assert.Equal(3, expanded.Count);
        Assert.Contains(root.Id, expanded);
        Assert.Contains(child.Id, expanded);
        Assert.Contains(grandchild.Id, expanded);
        Assert.DoesNotContain(unrelated.Id, expanded);
    }

    [Fact]
    public void CyclicDatabaseRowsAbortRecursiveDeletion()
    {
        var collectionId = Guid.NewGuid();
        var first = new CollectionFolder(collectionId, null, "First");
        var second = new CollectionFolder(collectionId, first.Id, "Second");
        first.Move(second.Id);

        var error = Assert.Throws<AppException>(() =>
            CloudFolderRules.ExpandSubtrees([first, second], [first.Id]));

        Assert.Equal(409, error.StatusCode);
    }

    [Fact]
    public void TransferIntoAnotherCollectionIncludesDescendantsAndPreservesIdentity()
    {
        var sourceId=Guid.NewGuid();
        var targetId=Guid.NewGuid();
        var parent=new CollectionFolder(sourceId,null,"Auth");
        var child=new CollectionFolder(sourceId,parent.Id,"JWT");
        var unrelated=new CollectionFolder(sourceId,null,"Other");
        var destination=new CollectionFolder(targetId,null,"Billing");
        var move=CloudFolderRules.ValidateTransfer([parent,child,unrelated],
            [destination],parent,targetId,destination.Id);
        Assert.Contains(parent.Id,move);
        Assert.Contains(child.Id,move);
        Assert.DoesNotContain(unrelated.Id,move);
        var original=parent.Version;
        parent.Rehome(targetId,destination.Id);
        Assert.Equal(targetId,parent.CollectionId);
        Assert.Equal(original+1,parent.Version);
    }

    [Fact]
    public void TransferRejectsNameCollisionAtDestination()
    {
        var sourceId=Guid.NewGuid();
        var targetId=Guid.NewGuid();
        var original=new CollectionFolder(sourceId,null,"Auth");
        var clash=new CollectionFolder(targetId,null,"auth");
        var exception=Assert.Throws<AppException>(()=>CloudFolderRules.ValidateTransfer(
            [original],[clash],original,targetId,null));
        Assert.Equal(409,exception.StatusCode);
    }

}
