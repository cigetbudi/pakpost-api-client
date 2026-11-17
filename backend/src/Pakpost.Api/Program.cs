using Mediator;
using Pakpost.Application.Common.Behaviors;
using Pakpost.Application.Internal.Auth;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Pakpost.Api.Middlewares;
using Pakpost.Application;
using Pakpost.Infrastructure;
var builder=WebApplication.CreateBuilder(args);
builder.Services.AddControllers().AddJsonOptions(o=>o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddApplication();
// Generated at build time; scan Application for requests/handlers and register
// the existing FluentValidation pipeline. Scoped handlers keep DbContext safe.
builder.Services.AddMediator((MediatorOptions options) =>
{
    options.Assemblies = [typeof(RegisterCommand)];
    options.ServiceLifetime = Microsoft.Extensions.DependencyInjection.ServiceLifetime.Scoped;
    options.PipelineBehaviors = [typeof(ValidationBehavior<,>)];
});
builder.Services.AddInfrastructure(builder.Configuration);
var signingKey=builder.Configuration["Jwt:SigningKey"];
if(string.IsNullOrWhiteSpace(signingKey) || Encoding.UTF8.GetByteCount(signingKey)<32)
    throw new InvalidOperationException("Jwt__SigningKey must be at least 32 UTF-8 bytes");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o=>
{
    o.MapInboundClaims=false;
    o.TokenValidationParameters=new TokenValidationParameters
    {
        ValidateIssuer=true,ValidIssuer=builder.Configuration["Jwt:Issuer"]??"pakpost",
        ValidateAudience=true,ValidAudience=builder.Configuration["Jwt:Audience"]??"pakpost-client",
        ValidateLifetime=true,ValidateIssuerSigningKey=true,
        IssuerSigningKey=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
        ClockSkew=TimeSpan.FromSeconds(30)
    };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(o=>
{
    o.RejectionStatusCode=429;
    o.AddPolicy("public-proxy",c=>RateLimitPartition.GetFixedWindowLimiter(
        c.Connection.RemoteIpAddress?.ToString()??"unknown",_=>new FixedWindowRateLimiterOptions
        {PermitLimit=30,Window=TimeSpan.FromMinutes(1),QueueLimit=0,AutoReplenishment=true}));
    o.AddPolicy("auth",c=>RateLimitPartition.GetFixedWindowLimiter(
        "auth:"+(c.Connection.RemoteIpAddress?.ToString()??"unknown"),_=>new FixedWindowRateLimiterOptions
        {PermitLimit=10,Window=TimeSpan.FromMinutes(1),QueueLimit=0,AutoReplenishment=true}));
});
var origins=builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()??["http://localhost:5173"];
builder.Services.AddCors(o=>o.AddPolicy("Frontend",p=>p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));
// In-process limit on simultaneous anonymous outbound requests, in addition to per-IP rate limits.
// A multi-replica deployment also needs an ingress/distributed limit and egress firewall.
var proxyConcurrencyLimit=Math.Clamp(builder.Configuration.GetValue("Proxy:MaxConcurrentRequests",8),1,64);
using var proxySlots=new SemaphoreSlim(proxyConcurrencyLimit,proxyConcurrencyLimit);
var app=builder.Build();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseRouting();
app.UseCors("Frontend");
app.UseRateLimiter();
app.Use(async (context,next)=>
{
    // Private API responses must not be cached by intermediaries or HTTP caches.
    if(context.Request.Path.StartsWithSegments("/api/workspaces") ||
       context.Request.Path.StartsWithSegments("/api/auth") ||
       context.Request.Path.StartsWithSegments("/api/invitations"))
    {
        context.Response.Headers.CacheControl="no-store, private";
        context.Response.Headers.Pragma="no-cache";
    }
    if(!string.Equals(context.Request.Path.Value,"/api/proxy/send",StringComparison.OrdinalIgnoreCase))
    {
        await next();return;
    }
    // Nonblocking acquisition is intentional: do not queue memory-intensive public proxy calls.
    if(!proxySlots.Wait(0))
    {
        context.Response.StatusCode=429;
        await context.Response.WriteAsJsonAsync(new {message="Proxy is busy; retry shortly"});
        return;
    }
    try{await next();}
    finally{proxySlots.Release();}
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health",()=>Results.Ok(new{status="ok",service="pakpost-api",mode="anonymous-tester-with-private-workspaces"}));
app.Run();
