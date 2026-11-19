using Microsoft.AspNetCore.Http.Timeouts;
using Pakpost.Application.Internal.Requests.Commands;
using Pakpost.Application.Internal.Requests.DTOs;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Pakpost.Api.Controllers;
[ApiController,Route("api/proxy")]
[RequestTimeout("proxy")]
public sealed class ProxyController(ISender sender):ControllerBase
{
    // Public by design: no login needed to try an HTTP request.
    [HttpPost("send"),AllowAnonymous,EnableRateLimiting("public-proxy")]
    // The JSON transport base64-encodes binary/multipart uploads (up to 5 MiB decoded).
    // A 7.5 MB request cap accommodates this while bounding anonymous upload memory.
    [RequestSizeLimit(7_500_000)]
    public async Task<ActionResult<SendHttpResponse>> Send(SendHttpRequestCommand command,CancellationToken ct)
        =>Ok(await sender.Send(command,ct));
}
