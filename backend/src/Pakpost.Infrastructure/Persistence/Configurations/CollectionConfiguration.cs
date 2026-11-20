using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class CollectionConfiguration : IEntityTypeConfiguration<Collection>
{
    public void Configure(EntityTypeBuilder<Collection> builder)
    {
        builder.ToTable("collections", "collection");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(120).IsRequired();
        builder.Property(x => x.VariablesJson)
            .HasColumnName("variables_json")
            .HasColumnType("text")
            .HasDefaultValue("[]")
            .IsRequired();

        builder.Property(x => x.VariablesVersion)
            .HasColumnName("variables_version")
            .HasDefaultValue(0)
            .IsConcurrencyToken();
        builder.HasOne<Workspace>().WithMany().HasForeignKey(x => x.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Property(x => x.ParentCollectionId).HasColumnName("parent_collection_id");
        builder.Property(x => x.SortOrder).HasColumnName("sort_order").HasDefaultValue(0);
        builder.HasOne<Collection>().WithMany().HasForeignKey(x => x.ParentCollectionId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.WorkspaceId, x.ParentCollectionId, x.SortOrder });
        builder.HasIndex(x => x.WorkspaceId);
    }
}
