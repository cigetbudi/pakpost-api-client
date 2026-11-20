using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Configurations;

public sealed class SavedRequestConfiguration : IEntityTypeConfiguration<SavedRequest>
{
    public void Configure(EntityTypeBuilder<SavedRequest> builder)
    {
        builder.ToTable("saved_requests", "collection");
        builder.HasKey(request => request.Id);

        builder.Property(request => request.Revision)
            .HasColumnName("revision")
            .HasDefaultValue(1)
            .IsConcurrencyToken();

        builder.Property(request => request.Name).HasMaxLength(120).IsRequired();
        builder.Property(request => request.Method).HasMaxLength(10).IsRequired();
        builder.Property(request => request.Url).HasColumnType("text").IsRequired();
        builder.Property(request => request.HeadersJson).HasColumnType("jsonb").IsRequired();
        builder.Property(request => request.Body).HasColumnType("text").IsRequired();

        builder.Property(request => request.BodyMode)
            .HasMaxLength(20)
            .HasDefaultValue("raw")
            .IsRequired();

        builder.Property(request => request.ContentType)
            .HasMaxLength(150)
            .HasDefaultValue("application/json")
            .IsRequired();

        builder.Property(request => request.FormFieldsJson)
            .HasColumnType("jsonb")
            .HasDefaultValue("[]")
            .IsRequired();

        builder.Property(request => request.PreRequestScript)
            .HasColumnType("text")
            .HasDefaultValue("")
            .IsRequired();

        builder.Property(request => request.PostResponseScript)
            .HasColumnType("text")
            .HasDefaultValue("")
            .IsRequired();

        builder.HasOne<Collection>()
            .WithMany()
            .HasForeignKey(request => request.CollectionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<CollectionFolder>()
            .WithMany()
            .HasForeignKey(request => request.FolderId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.Property(request => request.SortOrder)
            .HasColumnName("sort_order").HasDefaultValue(int.MaxValue);
        builder.HasIndex(request => new { request.CollectionId, request.FolderId,
            request.SortOrder, request.Id });
        builder.HasIndex(request => request.CollectionId);
        builder.HasIndex(request => request.FolderId);
        builder.HasIndex(request => new { request.CollectionId, request.Id });
        builder.HasIndex(request => new { request.CollectionId, request.FolderId, request.Id });
        builder.HasIndex(request => new { request.CollectionId, request.Name, request.Id });
        builder.HasIndex(request => new { request.CollectionId, request.FolderId, request.Name, request.Id });
    }
}
