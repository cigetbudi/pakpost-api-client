using Pakpost.Application.Common.Exceptions;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Services;

// Only organization metadata changes. Request, folder and variable data stay untouched.
public static class CollectionPlacementRules
{
    private const int MaxDepth = 12;

    public static void Arrange(IReadOnlyList<Collection> items, Guid sourceId, Guid? targetId, string placement)
    {
        if (placement is not ("inside" or "before" or "after" or "root"))
            throw AppException.BadRequest("Invalid collection placement");
        var byId = items.ToDictionary(item => item.Id);
        if (!byId.TryGetValue(sourceId, out var source)) throw AppException.NotFound("Collection not found");
        Collection? target = null;
        if (placement != "root")
        {
            if (!targetId.HasValue || !byId.TryGetValue(targetId.Value, out target))
                throw AppException.BadRequest("Destination collection does not exist in this workspace");
        }
        if (sourceId == target?.Id) throw AppException.BadRequest("Cannot move collection into itself");
        var newParent = placement == "root" ? (Guid?)null :
            placement == "inside" ? target!.Id : target!.ParentCollectionId;

        // Guard against cycles and malformed pre-existing parent chains.
        var visited = new HashSet<Guid> { sourceId };
        var cursor = newParent;
        var parentDepth = 0;
        while (cursor.HasValue)
        {
            if (!visited.Add(cursor.Value) || !byId.TryGetValue(cursor.Value, out var parent))
                throw AppException.BadRequest("Cannot move a collection into itself or its descendants");
            if (++parentDepth >= MaxDepth) throw AppException.BadRequest("Collection nesting limit exceeded");
            cursor = parent.ParentCollectionId;
        }
        int SubtreeHeight(Guid id, HashSet<Guid> visiting)
        {
            if (!visiting.Add(id)) throw AppException.BadRequest("Invalid cyclic collection hierarchy");
            var height = 1;
            foreach (var child in items.Where(item => item.ParentCollectionId == id))
                height = Math.Max(height, 1 + SubtreeHeight(child.Id, visiting));
            visiting.Remove(id);
            return height;
        }
        if (parentDepth + SubtreeHeight(sourceId, new HashSet<Guid>()) > MaxDepth)
            throw AppException.BadRequest("Collection subtree would exceed nesting limit");

        static IOrderedEnumerable<Collection> Ordered(IEnumerable<Collection> siblings) =>
            siblings.OrderBy(item => item.SortOrder).ThenBy(item => item.Name).ThenBy(item => item.Id);

        var previousParent = source.ParentCollectionId;
        var oldSiblings = Ordered(items.Where(item => item.ParentCollectionId == previousParent && item.Id != source.Id)).ToList();
        var nextSiblings = Ordered(items.Where(item => item.ParentCollectionId == newParent && item.Id != source.Id)).ToList();
        var index = placement switch
        {
            "before" => nextSiblings.FindIndex(item => item.Id == target!.Id),
            "after" => nextSiblings.FindIndex(item => item.Id == target!.Id) + 1,
            _ => nextSiblings.Count
        };
        if (index < 0) throw AppException.BadRequest("Destination is no longer a sibling");
        nextSiblings.Insert(index, source);
        for (var i = 0; i < nextSiblings.Count; i++) nextSiblings[i].Place(newParent, i + 1);
        if (previousParent != newParent)
            for (var i = 0; i < oldSiblings.Count; i++) oldSiblings[i].Place(previousParent, i + 1);
    }
}
