using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pakpost.Domain.Entities;
namespace Pakpost.Infrastructure.Persistence.Configurations;
public sealed class WorkspaceMemberRoleConfiguration:IEntityTypeConfiguration<WorkspaceMemberRole>
{
    public void Configure(EntityTypeBuilder<WorkspaceMemberRole> builder)
    {
        builder.ToTable("workspace_member_roles","organization");
        builder.HasKey(x=>new{x.WorkspaceId,x.UserId,x.Role});
        builder.Property(x=>x.Role).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.HasOne<WorkspaceMember>().WithMany(m=>m.Roles)
            .HasForeignKey(x=>new{x.WorkspaceId,x.UserId})
            .OnDelete(DeleteBehavior.Cascade);
    }
}
