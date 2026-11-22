using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Internal.Collections.Services;
using Pakpost.Domain.Entities;
using Xunit;

namespace Pakpost.UnitTests;

public sealed class CollectionPlacementRulesTests
{
    private static Collection New(Guid ws, string name) => new(ws, name, Guid.NewGuid());

    [Fact]
    public void Move_Inside_And_Back_To_Root_Without_Modifying_Collection_Identity()
    {
        var workspace = Guid.NewGuid();
        var source = New(workspace, "Auth");
        var target = New(workspace, "Billing");
        var items = new[] { source, target };
        CollectionPlacementRules.Arrange(items, source.Id, target.Id, "inside");
        Assert.Equal(target.Id, source.ParentCollectionId);
        Assert.Equal(1, source.SortOrder);
        CollectionPlacementRules.Arrange(items, source.Id, null, "root");
        Assert.Null(source.ParentCollectionId);
        Assert.Equal(source.Id, items[0].Id);
    }

    [Fact]
    public void Reorder_Siblings_And_Reject_Self_Or_Descendant_Cycle()
    {
        var workspace = Guid.NewGuid();
        var a = New(workspace, "A");
        var b = New(workspace, "B");
        var c = New(workspace, "C");
        var items = new[] { a, b, c };
        CollectionPlacementRules.Arrange(items, c.Id, a.Id, "before");
        Assert.Equal(1, c.SortOrder);
        Assert.Equal(2, a.SortOrder);
        Assert.Equal(3, b.SortOrder);
        CollectionPlacementRules.Arrange(items, a.Id, b.Id, "inside");
        Assert.Equal(b.Id, a.ParentCollectionId);
        Assert.Throws<AppException>(()=>CollectionPlacementRules.Arrange(items,b.Id,a.Id,"inside"));
        Assert.Throws<AppException>(()=>CollectionPlacementRules.Arrange(items,a.Id,a.Id,"inside"));
        Assert.Throws<AppException>(()=>CollectionPlacementRules.Arrange(items,a.Id,Guid.NewGuid(),"inside"));
    }

    [Fact]
    public void Prevents_Too_Deep_Collection_Subtrees()
    {
        var ws=Guid.NewGuid();
        var items=new List<Collection>();
        for(var i=0;i<12;i++)
        {
            var collection=New(ws,$"Level {i}");
            if(i>0)collection.Place(items[^1].Id,1);
            items.Add(collection);
        }
        var extra=New(ws,"Extra");items.Add(extra);
        Assert.Throws<AppException>(()=>CollectionPlacementRules.Arrange(items,extra.Id,items[11].Id,"inside"));
    }
}
