namespace Pakpost.Domain.Entities;
public sealed class TeamMember
{
    private TeamMember() { }
    public Guid TeamId { get; private set; }
    public Guid UserId { get; private set; }
    public DateTimeOffset JoinedAt { get; private set; }
    public TeamMember(Guid teamId,Guid userId)
    {TeamId=teamId;UserId=userId;JoinedAt=DateTimeOffset.UtcNow;}
}
